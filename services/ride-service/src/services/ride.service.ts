import { PrismaClient, Ride, RideStatus } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { RideStateMachine } from '../domain/ride-state-machine';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';
import { DriverOfferManager } from './driver-offer-manager';
import { pricingGrpcClient } from '../grpc/pricing.client';
import { driverGrpcClient } from '../grpc/driver.client';

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
  vehicleType?: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
  paymentMethod?: 'CASH' | 'CARD' | 'WALLET' | 'MOMO' | 'VNPAY';
  voucherCode?: string;
}

interface Location {
  lat: number;
  lng: number;
}

interface RideUserProfile {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  avatar?: string | null;
}

type VehicleTypeStr = 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';

export class RideService {
  private prisma: PrismaClient;
  private eventPublisher: EventPublisher;
  private offerManager: DriverOfferManager;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher, offerManager?: DriverOfferManager) {
    this.prisma = prisma;
    this.eventPublisher = eventPublisher;
    this.offerManager = offerManager || new DriverOfferManager();
  }

  private shouldStartFindingDriverImmediately(paymentMethod?: string): boolean {
    return (paymentMethod || 'CASH') === 'CASH';
  }

  private async fetchUserProfileFromUserService(userId: string): Promise<RideUserProfile | null> {
    try {
      const response = await axios.get(`${config.services.user}/api/users/${userId}`, {
        timeout: 3000,
        headers: { 'x-internal-token': config.internalServiceToken },
      });

      return response.data?.data?.user ?? null;
    } catch (error) {
      logger.warn(`Failed to hydrate ride profile from user-service for ${userId}:`, error);
      return null;
    }
  }

  private async fetchUserProfileFromAuthService(userId: string): Promise<RideUserProfile | null> {
    try {
      const response = await axios.get(`${config.services.auth}/internal/users/${userId}`, {
        timeout: 3000,
        headers: { 'x-internal-token': config.internalServiceToken },
      });

      return response.data?.data?.user ?? null;
    } catch (error) {
      logger.warn(`Failed to hydrate ride profile from auth-service for ${userId}:`, error);
      return null;
    }
  }

  private async getUserProfile(userId?: string | null): Promise<RideUserProfile | null> {
    if (!userId) {
      return null;
    }

    const userProfile = await this.fetchUserProfileFromUserService(userId);
    if (userProfile) {
      return userProfile;
    }

    return this.fetchUserProfileFromAuthService(userId);
  }

  private mapCustomerProfile(profile: RideUserProfile | null) {
    if (!profile) {
      return undefined;
    }

    return {
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phoneNumber: profile.phoneNumber || profile.phone || undefined,
      avatar: profile.avatar || undefined,
    };
  }

  private async enrichRideCustomer<T extends Ride | null>(ride: T): Promise<T> {
    if (!ride?.customerId) {
      return ride;
    }

    const customerProfile = await this.getUserProfile(ride.customerId);
    if (!customerProfile) {
      return ride;
    }

    return {
      ...ride,
      customer: this.mapCustomerProfile(customerProfile),
    } as T;
  }

  private async enrichRideCustomers<T extends Ride>(rides: T[]): Promise<T[]> {
    const profileCache = new Map<string, Promise<RideUserProfile | null>>();

    return Promise.all(rides.map(async (ride) => {
      if (!ride.customerId) {
        return ride;
      }

      let profilePromise = profileCache.get(ride.customerId);
      if (!profilePromise) {
        profilePromise = this.getUserProfile(ride.customerId);
        profileCache.set(ride.customerId, profilePromise);
      }

      const customerProfile = await profilePromise;
      if (!customerProfile) {
        return ride;
      }

      return {
        ...ride,
        customer: this.mapCustomerProfile(customerProfile),
      } as T;
    }));
  }

  private normalizeVoucherCode(voucherCode?: string | null): string | null {
    const normalizedCode = voucherCode?.trim().toUpperCase();
    return normalizedCode ? normalizedCode : null;
  }

  isChatEnabledStatus(status: RideStatus): boolean {
    switch (status) {
      case RideStatus.ASSIGNED:
      case RideStatus.ACCEPTED:
      case RideStatus.PICKING_UP:
      case RideStatus.IN_PROGRESS:
        return true;
      default:
        return false;
    }
  }

  isChatHistoryAvailableStatus(status: RideStatus): boolean {
    return this.isChatEnabledStatus(status)
      || status === RideStatus.COMPLETED
      || status === RideStatus.CANCELLED;
  }

  private getCompatibleDriverVehicleTypes(requestedVehicleType?: string): string[] | null {
    switch ((requestedVehicleType || '').toUpperCase()) {
      case 'MOTORBIKE':
        return ['MOTORBIKE'];
      case 'SCOOTER':
        return ['SCOOTER'];
      case 'CAR_4':
        return ['CAR_4'];
      case 'CAR_7':
        return ['CAR_7'];
      // legacy fallback
      case 'ECONOMY':
        return ['MOTORBIKE'];
      case 'COMFORT':
        return ['CAR_4'];
      case 'PREMIUM':
        return ['CAR_7'];
      default:
        return null;
    }
  }

  private isCompatibleDriverVehicleType(driverVehicleType: string | undefined, requestedVehicleType?: string): boolean {
    const compatibleDriverTypes = this.getCompatibleDriverVehicleTypes(requestedVehicleType);
    if (!compatibleDriverTypes || !driverVehicleType) {
      return true;
    }

    return compatibleDriverTypes.includes(driverVehicleType.toUpperCase());
  }

  private async ensureDriverVehicleCompatibility(driverId: string, requestedVehicleType?: string): Promise<void> {
    const driver = await driverGrpcClient.getDriverById(driverId);
    if (!driver) {
      throw new Error('Driver profile not found');
    }

    if (!this.isCompatibleDriverVehicleType(driver.vehicleType, requestedVehicleType)) {
      throw new Error('Driver vehicle type is not compatible with this ride');
    }
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
    const normalizedVoucherCode = this.normalizeVoucherCode(input.voucherCode);

    // Get ETA and surge from Pricing service (with fallback)
    let surgeMultiplier = 1.0;
    let estimatedFare = 0;
    let distance = 0;
    let duration = 0;

    try {
      const payload = await pricingGrpcClient.estimateFare({
        pickupLat: input.pickup.lat,
        pickupLng: input.pickup.lng,
        dropoffLat: input.dropoff.lat,
        dropoffLng: input.dropoff.lng,
        vehicleType: input.vehicleType || 'CAR_4',
      });

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
        vehicleType: input.vehicleType || 'CAR_4',
        paymentMethod: input.paymentMethod || 'CASH',
        voucherCode: normalizedVoucherCode,
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

    // CASH rides start matching immediately. Online payments wait for payment.completed.
    if (this.shouldStartFindingDriverImmediately(ride.paymentMethod)) {
      await this.requestDriverSuggestions(ride);
    }

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
    voucherCode?: string;
    fare?: number;
    distance?: number;
    duration?: number;
    surgeMultiplier?: number;
  }): Promise<Ride> {
    const rideId = uuidv4();
    const normalizedVoucherCode = this.normalizeVoucherCode(data.voucherCode);

    const shouldStartFindingDriver = this.shouldStartFindingDriverImmediately(data.paymentMethod);

    const ride = await this.prisma.ride.create({
      data: {
        id: rideId,
        customerId: data.customerId,
        status: shouldStartFindingDriver ? RideStatus.FINDING_DRIVER : RideStatus.CREATED,
        vehicleType: (data.vehicleType as any) || 'CAR_4',
        paymentMethod: data.paymentMethod as any,
        voucherCode: normalizedVoucherCode,
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
            toStatus: shouldStartFindingDriver ? RideStatus.FINDING_DRIVER : RideStatus.CREATED,
            actorId: data.customerId,
            actorType: 'CUSTOMER',
          },
        },
      },
    });

    logger.info('Ride created from booking', { rideId, bookingId: data.bookingId });

    if (shouldStartFindingDriver) {
      await this.requestDriverSuggestions(ride);
    }

    return ride;
  }

  async startFindingDriverAfterPayment(rideId: string): Promise<void> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      logger.warn(`Cannot start finding driver: ride not found ${rideId}`);
      return;
    }

    if (this.shouldStartFindingDriverImmediately(ride.paymentMethod)) {
      return;
    }

    if (ride.status !== RideStatus.CREATED) {
      return;
    }

    await this.requestDriverSuggestions(ride);
  }

  async assignDriver(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new Error('Ride not found');

    await this.ensureDriverVehicleCompatibility(driverId, ride.vehicleType);

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
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
    }, rideId);
   
     // Notify other drivers ride is no longer available
     await this.eventPublisher.publish('ride.no_longer_available', {
       rideId,
       acceptedBy: driverId,
     }, rideId);

    return updatedRide;
  }

    async driverAcceptRide(rideId: string, driverId: string): Promise<Ride> {
      // Pre-flight eligibility check (non-atomic read for fast rejection)
      const candidateRide = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!candidateRide) throw new Error('Ride not found');

      if (candidateRide.status !== RideStatus.FINDING_DRIVER) {
        throw new Error(`Ride is not available for acceptance. Current status: ${candidateRide.status}`);
      }

      if (candidateRide.suggestedDriverIds && candidateRide.suggestedDriverIds.length > 0) {
        if (!candidateRide.suggestedDriverIds.includes(driverId)) {
          throw new Error('Driver is not eligible for this ride');
        }
      }

      await this.ensureDriverVehicleCompatibility(driverId, candidateRide.vehicleType);

      // ── Atomic claim ──────────────────────────────────────────────────────
      // updateMany with a status predicate in the WHERE clause is atomic at the
      // DB level. Only one concurrent caller can get count > 0; everyone else
      // gets count = 0 and must throw a "ride no longer available" error.
      const claimed = await this.prisma.ride.updateMany({
        where: { id: rideId, status: RideStatus.FINDING_DRIVER },
        data: {
          status: RideStatus.ASSIGNED,
          driverId,
          acceptedDriverId: driverId,
          assignedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        // Lost the race — another driver was faster
        const current = await this.prisma.ride.findUnique({ where: { id: rideId } });
        throw new Error(
          `Ride is no longer available. Current status: ${current?.status ?? 'UNKNOWN'}`
        );
      }

      // Record the state-transition audit log (safe after atomic claim)
      const updatedRide = await this.prisma.ride.update({
        where: { id: rideId },
        data: {
          transitions: {
            create: {
              fromStatus: RideStatus.FINDING_DRIVER,
              toStatus: RideStatus.ASSIGNED,
              actorId: driverId,
              actorType: 'DRIVER',
            },
          },
        },
      });

      // Publish events outside the DB write path
      await this.eventPublisher.publish('ride.assigned', {
        rideId,
        driverId,
        customerId: candidateRide.customerId,
        pickup: { lat: candidateRide.pickupLat, lng: candidateRide.pickupLng, address: candidateRide.pickupAddress },
      }, rideId);

      await this.eventPublisher.publish('ride.no_longer_available', {
        rideId,
        acceptedBy: driverId,
      }, rideId);

      logger.info(`Driver ${driverId} atomically claimed ride ${rideId}`);
      return updatedRide;
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
      voucherCode: ride.voucherCode || undefined,
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
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { transitions: { orderBy: { occurredAt: 'asc' } } },
    });

    return this.enrichRideCustomer(ride as Ride | null);
  }

  async getRideMessages(rideId: string, limit = 100): Promise<any[]> {
    const normalizedLimit = Math.min(Math.max(limit, 1), 200);

    const messages = await this.prisma.rideChatMessage.findMany({
      where: { rideId },
      orderBy: { createdAt: 'desc' },
      take: normalizedLimit,
    });

    return [...messages].reverse();
  }

  async createRideMessage(
    rideId: string,
    senderId: string,
    senderRole: string,
    rawMessage: string,
    type = 'TEXT',
  ): Promise<any> {
    const message = rawMessage.trim();
    if (!message) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 500) {
      throw new Error('Message is too long');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true },
    });

    if (!ride) {
      throw new Error('Ride not found');
    }

    if (!this.isChatEnabledStatus(ride.status)) {
      throw new Error('Chat is only available while the trip is active');
    }

    return this.prisma.rideChatMessage.create({
      data: {
        rideId,
        senderId,
        senderRole,
        type: type || 'TEXT',
        message,
      },
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
    return { rides: await this.enrichRideCustomers(rides), total };
  }

  async getDriverRides(
    driverIdOrIds: string | string[],
    page = 1,
    limit = 20,
    statuses?: RideStatus[]
  ): Promise<{ rides: Ride[]; total: number }> {
    const skip = (page - 1) * limit;
    const driverIds = Array.isArray(driverIdOrIds) ? driverIdOrIds : [driverIdOrIds];
    const normalizedDriverIds = [...new Set(driverIds.filter(Boolean))];

    const where = {
      driverId: normalizedDriverIds.length === 1 ? normalizedDriverIds[0] : { in: normalizedDriverIds },
      ...(statuses && statuses.length > 0
        ? { status: statuses.length === 1 ? statuses[0] : { in: statuses } }
        : {}),
    };

    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.ride.count({ where }),
    ]);
    return { rides: await this.enrichRideCustomers(rides), total };
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
    const ride = await this.prisma.ride.findFirst({
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

    return this.enrichRideCustomer(ride);
  }

  async getActiveRideForDriver(driverId: string): Promise<Ride | null> {
    const ride = await this.prisma.ride.findFirst({
      where: {
        driverId,
        status: { in: [RideStatus.ASSIGNED, RideStatus.ACCEPTED, RideStatus.PICKING_UP, RideStatus.IN_PROGRESS] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.enrichRideCustomer(ride);
  }

  async getAvailableRides(driverLat: number, driverLng: number, radiusKm: number, vehicleType?: string): Promise<any[]> {
    const compatibleRideTypes = this.getCompatibleRideTypesForDriver(vehicleType);

    // Fetch rides looking for drivers
    const rides = await this.prisma.ride.findMany({
      where: {
        status: RideStatus.FINDING_DRIVER,
        ...(compatibleRideTypes ? { vehicleType: { in: compatibleRideTypes } } : {}),
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
      .map(({ distanceKm, ...ride }) => {
        const etaMinutes = parseFloat(Math.max(1, (distanceKm / 24) * 60).toFixed(1));
        return {
          ...ride,
          distanceFromDriver: parseFloat(distanceKm.toFixed(2)),
          distanceFromDriverMeters: Math.round(distanceKm * 1000),
          durationFromDriverSeconds: Math.max(60, Math.round((distanceKm / 24) * 3600)),
          etaMinutes,
        };
      });

    return this.enrichRideCustomers(availableRides as Ride[]);
  }

  async countCompletedRidesForDriver(driverIdOrIds: string | string[]): Promise<number> {
    const driverIds = Array.isArray(driverIdOrIds) ? driverIdOrIds : [driverIdOrIds];
    const normalizedDriverIds = [...new Set(
      driverIds
        .map((driverId) => driverId?.trim())
        .filter((driverId): driverId is string => Boolean(driverId))
    )];

    if (normalizedDriverIds.length === 0) {
      return 0;
    }

    return this.prisma.ride.count({
      where: {
        driverId: normalizedDriverIds.length === 1 ? normalizedDriverIds[0] : { in: normalizedDriverIds },
        status: RideStatus.COMPLETED,
      },
    });
  }

  async countCompletedRidesForDrivers(driverIds: string[]): Promise<Record<string, number>> {
    const normalizedDriverIds = [...new Set(
      driverIds
        .map((driverId) => driverId?.trim())
        .filter((driverId): driverId is string => Boolean(driverId))
    )];

    if (normalizedDriverIds.length === 0) {
      return {};
    }

    const groupedCounts = await this.prisma.ride.groupBy({
      by: ['driverId'],
      where: {
        driverId: { in: normalizedDriverIds },
        status: RideStatus.COMPLETED,
      },
      _count: {
        _all: true,
      },
    });

    return groupedCounts.reduce<Record<string, number>>((counts, group) => {
      if (group.driverId) {
        counts[group.driverId] = group._count._all;
      }
      return counts;
    }, {});
  }

  async countCompletedRidesForCustomers(customerIds: string[]): Promise<Record<string, number>> {
    const normalizedCustomerIds = [...new Set(
      customerIds
        .map((customerId) => customerId?.trim())
        .filter((customerId): customerId is string => Boolean(customerId))
    )];

    if (normalizedCustomerIds.length === 0) {
      return {};
    }

    const groupedCounts = await this.prisma.ride.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: normalizedCustomerIds },
        status: RideStatus.COMPLETED,
      },
      _count: {
        _all: true,
      },
    });

    return groupedCounts.reduce<Record<string, number>>((counts, group) => {
      counts[group.customerId] = group._count._all;
      return counts;
    }, {});
  }

  private getCompatibleRideTypesForDriver(vehicleType?: string): VehicleTypeStr[] | undefined {
    if (!vehicleType) return undefined;
    switch (vehicleType.toUpperCase()) {
      case 'MOTORBIKE': return ['MOTORBIKE'];
      case 'SCOOTER':   return ['SCOOTER'];
      case 'CAR_4':     return ['CAR_4'];
      case 'CAR_7':     return ['CAR_7'];
      // legacy fallback
      case 'CAR':       return ['CAR_4'];
      case 'SUV':       return ['CAR_7'];
      case 'MOTORCYCLE':return ['MOTORBIKE'];
      default:          return undefined;
    }
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
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
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
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
      dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
      vehicleType: ride.vehicleType,
      fare: ride.fare,
      excludeDriverIds: excludedDrivers,
      attempt: ride.reassignAttempts + 1,
      maxAttempts: this.offerManager.getMaxReassignAttempts(),
      matchingStartedAt: ride.requestedAt?.toISOString?.() || new Date().toISOString(),
      maxWaitMs: config.ride.searchTimeoutMs,
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
      pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
      dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
      vehicleType: ride.vehicleType,
      fare: ride.fare,
      distance: ride.distance,
      duration: ride.duration,
      searchRadiusKm: config.ride.searchRadiusKm,
      attempt: 1,
      maxAttempts: this.offerManager.getMaxReassignAttempts(),
      matchingStartedAt: ride.requestedAt?.toISOString?.() || new Date().toISOString(),
      maxWaitMs: config.ride.searchTimeoutMs,
    }, ride.id);

    // ── Search timeout guard ──────────────────────────────────────────────
    // If the ride is still in FINDING_DRIVER after searchTimeoutMs (default 5 min),
    // auto-cancel it so the customer is not left waiting indefinitely (e.g. AI
    // service down, no drivers at all in the area).
    this.scheduleRideSearchTimeout(ride);
  }

  /**
   * Schedule an in-process safety timer that auto-cancels a ride stuck in
   * FINDING_DRIVER longer than the configured threshold.
   *
   * The timer is unref'd so it does not prevent graceful shutdown.
   * If the service restarts the timer is lost — for persistent timeouts,
   * consider a Redis SETEX key + keyspace notification.
   */
  private scheduleRideSearchTimeout(ride: Ride): void {
    const timeoutMs = config.ride.searchTimeoutMs;

    const timer = setTimeout(async () => {
      try {
        const current = await this.prisma.ride.findUnique({ where: { id: ride.id } });
        if (!current || current.status !== RideStatus.FINDING_DRIVER) {
          return; // Already accepted, cancelled, etc.
        }

        logger.warn(`Ride ${ride.id} stuck in FINDING_DRIVER for ${timeoutMs / 1000}s — auto-cancelling`);

        await this.prisma.ride.update({
          where: { id: ride.id },
          data: {
            status: RideStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: 'Không tìm được tài xế trong thời gian cho phép',
            cancelledBy: 'SYSTEM',
            transitions: {
              create: {
                fromStatus: RideStatus.FINDING_DRIVER,
                toStatus: RideStatus.CANCELLED,
                actorId: 'system',
                actorType: 'SYSTEM',
                reason: 'Search timeout',
              },
            },
          },
        });

        await this.eventPublisher.publish('ride.cancelled', {
          rideId: ride.id,
          customerId: ride.customerId,
          driverId: null,
          cancelledBy: 'SYSTEM',
          reason: 'Không tìm được tài xế',
        }, ride.id);

        await this.eventPublisher.publish('ride.no_driver_found', {
          rideId: ride.id,
          customerId: ride.customerId,
        }, ride.id);
      } catch (err) {
        logger.error(`Search-timeout handler error for ride ${ride.id}:`, err);
      }
    }, timeoutMs);

    timer.unref(); // Do not block graceful process shutdown
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
