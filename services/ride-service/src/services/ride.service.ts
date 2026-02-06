import { PrismaClient, Ride, RideStatus } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { RideStateMachine } from '../domain/ride-state-machine';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';
import { DriverOfferManager } from './driver-offer-manager';

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
  private offerManager: DriverOfferManager;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher, offerManager?: DriverOfferManager) {
    this.prisma = prisma;
    this.eventPublisher = eventPublisher;
    this.offerManager = offerManager || new DriverOfferManager();
  }

  async createRide(input: CreateRideInput): Promise<Ride> {
    // Check for existing active ride to prevent duplicates
    const existingRide = await this.prisma.ride.findFirst({
      where: {
        customerId: input.customerId,
        status: {
          in: [
            RideStatus.CREATED,
            RideStatus.FINDING_DRIVER,
            RideStatus.ASSIGNED,
            RideStatus.ACCEPTED,
            RideStatus.PICKING_UP,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (existingRide) {
      throw new Error('Customer already has an active ride. Please cancel it first.');
    }

    const rideId = uuidv4();

    // Get ETA and surge from Pricing service (with fallback)
    let surgeMultiplier = 1.0;
    let estimatedFare = 0;
    let distance = 0;
    let duration = 0;

    try {
      const pricingResponse = await axios.post(
        `${config.services.pricing}/api/pricing/estimate`,
        {
          pickupLat: input.pickup.lat,
          pickupLng: input.pickup.lng,
          dropoffLat: input.dropoff.lat,
          dropoffLng: input.dropoff.lng,
          vehicleType: input.vehicleType || 'ECONOMY',
        },
        { timeout: 1500 }
      );

      const payload = pricingResponse.data?.data ?? pricingResponse.data ?? {};
      surgeMultiplier = payload.surgeMultiplier ?? payload.surge_multiplier ?? 1.0;
      estimatedFare = payload.fare ?? payload.estimated_fare ?? 0;
      distance = payload.distance ?? payload.distance_km ?? 0;
      duration = payload.duration ?? (payload.duration_minutes ? payload.duration_minutes * 60 : 0);
    } catch (error) {
      logger.warn('Pricing service unavailable, using fallback calculation');
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
        suggestedDriverIds: [],  // Initialize empty array
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

  /**
   * Create ride from booking (called by event consumer)
   */
  async createRideFromBooking(data: {
    bookingId: string;
    customerId: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    vehicleType: string;
    paymentMethod: string;
    fare?: number;
    distance?: number;
    duration?: number;
    surgeMultiplier?: number;
  }): Promise<Ride> {
    const rideId = uuidv4();

    const ride = await this.prisma.ride.create({
      data: {
        id: rideId,
        customerId: data.customerId,
        status: RideStatus.FINDING_DRIVER,
        vehicleType: data.vehicleType as any,
        paymentMethod: data.paymentMethod as any,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        distance: data.distance || 0,
        duration: data.duration || 0,
        fare: data.fare || 0,
        surgeMultiplier: data.surgeMultiplier || 1.0,
        suggestedDriverIds: [],
        transitions: {
          create: {
            fromStatus: null,
            toStatus: RideStatus.FINDING_DRIVER,
            actorId: data.customerId,
            actorType: 'CUSTOMER',
          },
        },
      },
    });

    logger.info('Ride created from booking', { rideId, bookingId: data.bookingId });

    // Publish ride.assignment.requested event
    await this.eventPublisher.publish('ride.assignment.requested', {
      rideId: ride.id,
      customerId: ride.customerId,
      vehicleType: ride.vehicleType,
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    }, ride.id);

    // Request driver suggestions
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
        throw new Error(`Ride is not available for acceptance. Current status: ${ride.status}`);
      }
    
      // Verify driver is in suggested list (if list is not empty)
      if (ride.suggestedDriverIds && ride.suggestedDriverIds.length > 0) {
        if (!ride.suggestedDriverIds.includes(driverId)) {
          throw new Error('Driver is not eligible for this ride');
        }
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
      vehicleType: ride.vehicleType,
      paymentMethod: ride.paymentMethod,
      surgeMultiplier: ride.surgeMultiplier,
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

  async getAllRides(page = 1, limit = 20, status?: RideStatus): Promise<{ rides: Ride[]; total: number }> {
    const skip = (page - 1) * limit;
    const where = status ? { status } : undefined;

    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ride.count({ where }),
    ]);

    return { rides, total };
  }

  async getRideStats(): Promise<{
    total: number;
    today: number;
    pending: number;
    active: number;
    completed: number;
    cancelled: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const pendingStatuses = [RideStatus.CREATED, RideStatus.FINDING_DRIVER];
    const activeStatuses = [
      RideStatus.ASSIGNED,
      RideStatus.ACCEPTED,
      RideStatus.PICKING_UP,
      RideStatus.IN_PROGRESS,
    ];

    const [total, today, pending, active, completed, cancelled] = await Promise.all([
      this.prisma.ride.count(),
      this.prisma.ride.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.ride.count({ where: { status: { in: pendingStatuses } } }),
      this.prisma.ride.count({ where: { status: { in: activeStatuses } } }),
      this.prisma.ride.count({ where: { status: RideStatus.COMPLETED } }),
      this.prisma.ride.count({ where: { status: RideStatus.CANCELLED } }),
    ]);

    return { total, today, pending, active, completed, cancelled };
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

  /**
   * Offer a ride to a specific driver with TTL
   * Creates OFFERED status and sets up automatic timeout
   */
  async offerRideToDriver(rideId: string, driverId: string, ttlSeconds: number = 20): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');

    // Check if driver has already been offered this ride
    const hasBeenOffered = await this.offerManager.hasBeenOffered(rideId, driverId);
    if (hasBeenOffered) {
      throw new Error('Driver has already been offered this ride');
    }

    // Check reassignment limit
    if (ride.reassignAttempts >= this.offerManager.getMaxReassignAttempts()) {
      throw new Error('Maximum reassignment attempts reached');
    }

    // Validate transition
    if (ride.status !== RideStatus.FINDING_DRIVER) {
      throw new Error(`Cannot offer ride in status ${ride.status}`);
    }

    // Create offer in Redis with TTL
    await this.offerManager.createOffer(rideId, driverId, ttlSeconds);

    // Update ride status to OFFERED
    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.OFFERED,
        driverId, // Temporarily assign to track who was offered
        offeredAt: new Date(),
        offeredDriverIds: {
          push: driverId,
        },
        reassignAttempts: { increment: 1 },
        transitions: {
          create: {
            fromStatus: ride.status,
            toStatus: RideStatus.OFFERED,
            actorId: 'system',
            actorType: 'SYSTEM',
            reason: `Offered to driver ${driverId} with ${ttlSeconds}s timeout`,
          },
        },
      },
    });

    // Publish ride.offered event
    await this.eventPublisher.publish('ride.offered', {
      rideId,
      driverId,
      customerId: ride.customerId,
      pickup: { 
        address: ride.pickupAddress,
        lat: ride.pickupLat, 
        lng: ride.pickupLng 
      },
      dropoff: {
        address: ride.dropoffAddress,
        lat: ride.dropoffLat,
        lng: ride.dropoffLng
      },
      fare: ride.fare,
      distance: ride.distance,
      ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }, rideId);

    logger.info(`Ride ${rideId} offered to driver ${driverId} with ${ttlSeconds}s timeout`);
    return updatedRide;
  }

  /**
   * Handle driver accepting an offered ride
   */
  async driverAcceptOfferedRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');

    // Check if this is the driver who was offered
    if (ride.status !== RideStatus.OFFERED) {
      throw new Error(`Ride is not in OFFERED status. Current status: ${ride.status}`);
    }

    if (ride.driverId !== driverId) {
      throw new Error('This ride was not offered to you');
    }

    // Accept the offer in Redis (removes TTL)
    const accepted = await this.offerManager.acceptOffer(rideId, driverId);
    if (!accepted) {
      throw new Error('Offer has expired or is no longer valid');
    }

    // Transition to ASSIGNED
    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.ASSIGNED,
        acceptedDriverId: driverId,
        assignedAt: new Date(),
        transitions: {
          create: {
            fromStatus: RideStatus.OFFERED,
            toStatus: RideStatus.ASSIGNED,
            actorId: driverId,
            actorType: 'DRIVER',
            reason: 'Driver accepted offer',
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

    logger.info(`Driver ${driverId} accepted offer for ride ${rideId}`);
    return updatedRide;
  }

  /**
   * Handle offer timeout - automatically triggered when Redis key expires
   */
  async handleOfferTimeout(rideId: string): Promise<void> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      logger.warn(`Offer timeout called for non-existent ride ${rideId}`);
      return;
    }

    // Only handle if still in OFFERED status
    if (ride.status !== RideStatus.OFFERED) {
      logger.debug(`Offer timeout for ride ${rideId} but status is ${ride.status}, ignoring`);
      return;
    }

    const timedOutDriverId = ride.driverId;
    logger.warn(`Offer timeout for ride ${rideId}, driver ${timedOutDriverId} did not respond`);

    // Mark offer as cancelled (adds to rejected list)
    await this.offerManager.cancelOffer(rideId, 'timeout');

    // Update ride - add to rejected list and go back to FINDING_DRIVER
    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.FINDING_DRIVER,
        driverId: null, // Clear the driver
        offeredAt: null,
        rejectedDriverIds: {
          push: timedOutDriverId!,
        },
        transitions: {
          create: {
            fromStatus: RideStatus.OFFERED,
            toStatus: RideStatus.FINDING_DRIVER,
            actorId: 'system',
            actorType: 'SYSTEM',
            reason: `Driver ${timedOutDriverId} timeout - no response`,
          },
        },
      },
    });

    // Publish timeout event
    await this.eventPublisher.publish('ride.offer_timeout', {
      rideId,
      timedOutDriverId,
      customerId: ride.customerId,
      reassignAttempts: updatedRide.reassignAttempts,
    }, rideId);

    // Try to re-assign to another driver
    await this.autoReassignDriver(updatedRide);
  }

  /**
   * Auto re-assign to another available driver
   * Excludes drivers who have already been offered or rejected
   */
  async autoReassignDriver(ride: Ride): Promise<void> {
    // Check if we've exceeded max attempts
    if (ride.reassignAttempts >= this.offerManager.getMaxReassignAttempts()) {
      logger.warn(`Max reassignment attempts (${ride.reassignAttempts}) reached for ride ${ride.id}`);
      
      await this.eventPublisher.publish('ride.reassignment_failed', {
        rideId: ride.id,
        customerId: ride.customerId,
        reason: 'Max attempts reached',
        attempts: ride.reassignAttempts,
      }, ride.id);
      return;
    }

    logger.info(`Auto re-assigning ride ${ride.id}, attempt ${ride.reassignAttempts + 1}`);

    // Get list of drivers to exclude (already offered or rejected)
    const excludedDrivers = [
      ...ride.offeredDriverIds,
      ...ride.rejectedDriverIds,
    ];

    // Request new driver suggestions with exclusion list
    await this.eventPublisher.publish('ride.reassignment_requested', {
      rideId: ride.id,
      customerId: ride.customerId,
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
      dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng },
      vehicleType: ride.vehicleType,
      fare: ride.fare,
      excludeDriverIds: excludedDrivers,
      attempt: ride.reassignAttempts + 1,
      maxAttempts: this.offerManager.getMaxReassignAttempts(),
    }, ride.id);

    logger.info(`Reassignment request sent for ride ${ride.id}, excluding ${excludedDrivers.length} drivers`);
  }

  /**
   * Driver rejects an offered ride
   */
  async driverRejectOffer(rideId: string, driverId: string, reason?: string): Promise<void> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');

    if (ride.status !== RideStatus.OFFERED) {
      throw new Error(`Ride is not in OFFERED status`);
    }

    if (ride.driverId !== driverId) {
      throw new Error('This ride was not offered to you');
    }

    // Cancel offer
    await this.offerManager.cancelOffer(rideId, 'rejected');

    // Update ride
    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.FINDING_DRIVER,
        driverId: null,
        offeredAt: null,
        rejectedDriverIds: {
          push: driverId,
        },
        transitions: {
          create: {
            fromStatus: RideStatus.OFFERED,
            toStatus: RideStatus.FINDING_DRIVER,
            actorId: driverId,
            actorType: 'DRIVER',
            reason: reason || 'Driver rejected offer',
          },
        },
      },
    });

    await this.eventPublisher.publish('ride.offer_rejected', {
      rideId,
      driverId,
      customerId: ride.customerId,
      reason: reason || 'Driver rejected',
    }, rideId);

    logger.info(`Driver ${driverId} rejected offer for ride ${rideId}`);

    // Try to re-assign
    await this.autoReassignDriver(updatedRide);
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
