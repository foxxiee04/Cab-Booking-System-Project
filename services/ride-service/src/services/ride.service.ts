import { PrismaClient, Ride, RideStatus } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { RideStateMachine } from '../domain/ride-state-machine';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

interface CreateRideInput {
  customerId: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };
  vehicleType?: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  paymentMethod?: 'CASH' | 'CARD' | 'WALLET';
}

interface Location {
  lat: number;
  lng: number;
}

export class RideService {
  private prisma: PrismaClient;
  private eventPublisher: EventPublisher;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.prisma = prisma;
    this.eventPublisher = eventPublisher;
  }

  async createRide(input: CreateRideInput): Promise<Ride> {
    const rideId = uuidv4();

    // Get ETA and surge from AI service (with fallback)
    let surgeMultiplier = 1.0;
    let estimatedFare = 0;
    let distance = 0;
    let duration = 0;

    try {
      const aiResponse = await axios.post(
        `${config.services.ai}/api/ride/estimate`,
        {
          pickup: { lat: input.pickup.lat, lng: input.pickup.lng },
          destination: { lat: input.dropoff.lat, lng: input.dropoff.lng },
        },
        { timeout: 800 }
      );
      
      surgeMultiplier = aiResponse.data.surge_multiplier || 1.0;
      estimatedFare = aiResponse.data.estimated_fare || 0;
      distance = aiResponse.data.distance_km || 0;
      // AI returns minutes; Ride schema stores seconds
      duration = (aiResponse.data.duration_minutes || 0) * 60;
    } catch (error) {
      logger.warn('AI service unavailable, using fallback calculation');
      // Fallback: simple distance calculation
      distance = this.calculateDistance(
        input.pickup.lat, input.pickup.lng,
        input.dropoff.lat, input.dropoff.lng
      );
      duration = Math.round(distance * 3 * 60); // estimate 3 min per km
      estimatedFare = this.calculateFallbackFare(distance, surgeMultiplier);
    }

    // Create ride
    const ride = await this.prisma.ride.create({
      data: {
        id: rideId,
        customerId: input.customerId,
         status: RideStatus.CREATED,
         vehicleType: input.vehicleType || 'ECONOMY',
         paymentMethod: input.paymentMethod || 'CASH',
        pickupAddress: input.pickup.address,
        pickupLat: input.pickup.lat,
        pickupLng: input.pickup.lng,
        dropoffAddress: input.dropoff.address,
        dropoffLat: input.dropoff.lat,
        dropoffLng: input.dropoff.lng,
        distance,
        duration,
        fare: estimatedFare,
        surgeMultiplier,
        transitions: {
          create: {
            fromStatus: null,
             toStatus: RideStatus.CREATED,
            actorId: input.customerId,
            actorType: 'CUSTOMER',
          },
        },
      },
    });

    // Publish event
    await this.eventPublisher.publish('ride.created', {
      rideId: ride.id,
      customerId: ride.customerId,
       vehicleType: ride.vehicleType,
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
      dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
      estimatedFare,
      surgeMultiplier,
    }, ride.id);

     // Request driver suggestions (AI will find nearby drivers)
     await this.requestDriverSuggestions(ride);

    return ride;
  }

  async assignDriver(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');

     // Validate transition from FINDING_DRIVER to ASSIGNED
     RideStateMachine.validateTransition(ride.status, RideStatus.ASSIGNED);
   
    // Hybrid mode: if suggested list exists and not empty, enforce; otherwise allow auto-assign
    if (ride.suggestedDriverIds && ride.suggestedDriverIds.length > 0) {
      if (!ride.suggestedDriverIds.includes(driverId)) {
        throw new Error('Driver is not in suggested drivers list');
      }
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.ASSIGNED,
        driverId,
         acceptedDriverId: driverId,
        assignedAt: new Date(),
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: RideStatus.ASSIGNED,
            actorId: driverId,
             actorType: 'DRIVER',
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.assigned', {
      rideId,
      driverId,
      customerId: ride.customerId,
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    }, rideId);
   
     // Notify other drivers ride is no longer available
     await this.eventPublisher.publish('ride.no_longer_available', {
       rideId,
       acceptedBy: driverId,
     }, rideId);

    return updatedRide;
  }

    async driverAcceptRide(rideId: string, driverId: string): Promise<Ride> {
      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new Error('Ride not found');
    
      // Only allow if ride is in FINDING_DRIVER status
      if (ride.status !== RideStatus.FINDING_DRIVER) {
        throw new Error('Ride is not available for acceptance');
      }
    
      // Verify driver is in suggested list
      if (!ride.suggestedDriverIds.includes(driverId)) {
        throw new Error('Driver is not eligible for this ride');
      }
    
      // Assign driver (transitions to ASSIGNED)
      return this.assignDriver(rideId, driverId);
    }
  async acceptRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');
    if (ride.driverId !== driverId) throw new Error('Driver not assigned to this ride');

    RideStateMachine.validateTransition(ride.status, RideStatus.ACCEPTED);

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.ACCEPTED,
        acceptedAt: new Date(),
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: RideStatus.ACCEPTED,
            actorId: driverId,
            actorType: 'DRIVER',
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.accepted', {
      rideId,
      driverId,
      customerId: ride.customerId,
    }, rideId);

    return updatedRide;
  }

  async rejectRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');
    if (ride.driverId !== driverId) throw new Error('Driver not assigned to this ride');

     // Go back to FINDING_DRIVER and find another driver
    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
         status: RideStatus.FINDING_DRIVER,
        driverId: null,
        assignedAt: null,
        transitions: {
          create: {
            fromStatus: ride.status,
             toStatus: RideStatus.FINDING_DRIVER,
            actorId: driverId,
            actorType: 'DRIVER',
            reason: 'Driver rejected',
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.rejected', {
      rideId,
      driverId,
      customerId: ride.customerId,
    }, rideId);

     // Request new driver suggestions
     await this.requestDriverSuggestions(updatedRide);

    return updatedRide;
  }
  
    async markPickedUp(rideId: string, driverId: string): Promise<Ride> {
      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new Error('Ride not found');
      if (ride.driverId !== driverId) throw new Error('Driver not assigned to this ride');
    
      RideStateMachine.validateTransition(ride.status, RideStatus.PICKING_UP);
    
      const updatedRide = await this.prisma.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.PICKING_UP,
          pickupAt: new Date(),
          transitions: {
            create: {
              fromStatus: ride.status,
              toStatus: RideStatus.PICKING_UP,
              actorId: driverId,
              actorType: 'DRIVER',
            },
          },
        },
      });
    
      await this.eventPublisher.publish('ride.picking_up', {
        rideId,
        driverId,
        customerId: ride.customerId,
      }, rideId);
    
      return updatedRide;
    }

  async startRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');
    if (ride.driverId !== driverId) throw new Error('Driver not assigned to this ride');

    RideStateMachine.validateTransition(ride.status, RideStatus.IN_PROGRESS);

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.IN_PROGRESS,
        startedAt: new Date(),
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: RideStatus.IN_PROGRESS,
            actorId: driverId,
            actorType: 'DRIVER',
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.started', {
      rideId,
      driverId,
      customerId: ride.customerId,
    }, rideId);

    return updatedRide;
  }

  async completeRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');
    if (ride.driverId !== driverId) throw new Error('Driver not assigned to this ride');

    RideStateMachine.validateTransition(ride.status, RideStatus.COMPLETED);

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.COMPLETED,
        completedAt: new Date(),
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: RideStatus.COMPLETED,
            actorId: driverId,
            actorType: 'DRIVER',
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.completed', {
      rideId,
      driverId,
      customerId: ride.customerId,
      fare: ride.fare,
      distance: ride.distance,
      duration: ride.duration,
    }, rideId);

    return updatedRide;
  }

  async cancelRide(rideId: string, userId: string, userType: 'CUSTOMER' | 'DRIVER', reason?: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');

    if (!RideStateMachine.canCancel(ride.status)) {
      throw new Error('Ride cannot be cancelled in current state');
    }

    // Verify user can cancel
    if (userType === 'CUSTOMER' && ride.customerId !== userId) {
      throw new Error('Customer can only cancel their own ride');
    }
    if (userType === 'DRIVER' && ride.driverId !== userId) {
      throw new Error('Driver can only cancel assigned ride');
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy: userType,
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: RideStatus.CANCELLED,
            actorId: userId,
            actorType: userType,
            reason,
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.cancelled', {
      rideId,
      customerId: ride.customerId,
      driverId: ride.driverId,
      cancelledBy: userType,
      reason,
    }, rideId);

    return updatedRide;
  }

  async getRideById(rideId: string): Promise<Ride | null> {
    return this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { transitions: { orderBy: { occurredAt: 'asc' } } },
    });
  }

  async getCustomerRides(customerId: string, page = 1, limit = 20): Promise<{ rides: Ride[]; total: number }> {
    const skip = (page - 1) * limit;
    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ride.count({ where: { customerId } }),
    ]);
    return { rides, total };
  }

  async getDriverRides(driverId: string, page = 1, limit = 20): Promise<{ rides: Ride[]; total: number }> {
    const skip = (page - 1) * limit;
    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where: { driverId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ride.count({ where: { driverId } }),
    ]);
    return { rides, total };
  }

  async getActiveRideForCustomer(customerId: string): Promise<Ride | null> {
    return this.prisma.ride.findFirst({
      where: {
        customerId,
        status: {
          in: [
            RideStatus.CREATED,
            RideStatus.FINDING_DRIVER,
            RideStatus.ASSIGNED,
            RideStatus.PICKING_UP,
            RideStatus.ACCEPTED,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveRideForDriver(driverId: string): Promise<Ride | null> {
    return this.prisma.ride.findFirst({
      where: {
        driverId,
        status: { in: [RideStatus.ASSIGNED, RideStatus.PICKING_UP, RideStatus.IN_PROGRESS] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAvailableRides(driverLat: number, driverLng: number, radiusKm: number, vehicleType?: string): Promise<any[]> {
    // Fetch rides looking for drivers
    const rides = await this.prisma.ride.findMany({
      where: {
        status: RideStatus.FINDING_DRIVER,
        ...(vehicleType && { vehicleType }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Compute distance and filter by radius
    const availableRides = rides
      .map((ride) => ({
        ...ride,
        distanceKm: this.calculateDistance(driverLat, driverLng, ride.pickupLat, ride.pickupLng),
      }))
      .filter((ride) => ride.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map(({ distanceKm, ...ride }) => ({
        ...ride,
        distanceFromDriver: parseFloat(distanceKm.toFixed(2)),
      }));

    return availableRides;
  }

  private async requestDriverSuggestions(ride: Ride): Promise<void> {
    // First, transition ride to FINDING_DRIVER if in CREATED state
    if (ride.status === RideStatus.CREATED) {
      await this.prisma.ride.update({
        where: { id: ride.id },
        data: {
          status: RideStatus.FINDING_DRIVER,
          transitions: {
            create: {
              fromStatus: RideStatus.CREATED,
              toStatus: RideStatus.FINDING_DRIVER,
              actorId: 'system',
              actorType: 'SYSTEM',
            },
          },
        },
      });
    }

    // Request AI service to find nearby drivers
    await this.eventPublisher.publish('ride.finding_driver_requested', {
      rideId: ride.id,
      customerId: ride.customerId,
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
     dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng },
     vehicleType: ride.vehicleType,
     fare: ride.fare,
      searchRadiusKm: config.ride.searchRadiusKm,
    }, ride.id);
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // km with 2 decimals
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private calculateFallbackFare(distanceKm: number, surge: number): number {
    const baseFare = 15000; // VND
    const perKmRate = 12000; // VND
    return Math.round((baseFare + distanceKm * perKmRate) * surge);
  }
}
