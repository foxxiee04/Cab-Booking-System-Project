import { PrismaClient, RideStatus } from '../generated/prisma-client';
import { EventPublisher } from '../events/publisher';
import { RideService } from '../services/ride.service';
import { DriverOfferManager } from '../services/driver-offer-manager';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('../generated/prisma-client');
jest.mock('../events/publisher');
jest.mock('ioredis');

describe('Driver Offer Timeout & Re-assignment', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let eventPublisher: jest.Mocked<EventPublisher>;
  let offerManager: DriverOfferManager;
  let rideService: RideService;
  let mockRedis: jest.Mocked<Redis>;
  let redisStrings: Map<string, string>;
  let redisSets: Map<string, Set<string>>;

  const mockRide = {
    id: 'ride-123',
    customerId: 'customer-1',
    driverId: null,
    status: RideStatus.FINDING_DRIVER,
    vehicleType: 'sedan',
    paymentMethod: 'cash',
    pickupAddress: '123 Main St',
    pickupLat: 10.762622,
    pickupLng: 106.660172,
    dropoffAddress: '456 Market St',
    dropoffLat: 10.772622,
    dropoffLng: 106.670172,
    estimatedPrice: 50000,
    estimatedDistance: 5.2,
    estimatedDuration: 15,
    fare: null,
    distance: null,
    duration: null,
    route: null,
    startTime: null,
    endTime: null,
    rating: null,
    review: null,
    cancellationReason: null,
    offeredDriverIds: [],
    rejectedDriverIds: [],
    reassignAttempts: 0,
    offeredAt: null,
    surgeMultiplier: 1.0,
    suggestedDriverIds: [],
    acceptedDriverId: null,
    requestedAt: new Date(),
    assignedAt: null,
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    redisStrings = new Map();
    redisSets = new Map();

    // Create mocked instances
    mockRedis = {
      on: jest.fn(),
      setex: jest.fn().mockImplementation(async (key: string, _ttl: number, value: string) => {
        redisStrings.set(key, value);
        return 'OK';
      }),
      del: jest.fn().mockImplementation(async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          deleted += Number(redisStrings.delete(key));
          deleted += Number(redisSets.delete(key));
        }
        return deleted;
      }),
      sadd: jest.fn().mockImplementation(async (key: string, value: string) => {
        const existing = redisSets.get(key) ?? new Set<string>();
        const previousSize = existing.size;
        existing.add(value);
        redisSets.set(key, existing);
        return existing.size > previousSize ? 1 : 0;
      }),
      sismember: jest.fn().mockImplementation(async (key: string, value: string) => {
        return redisSets.get(key)?.has(value) ? 1 : 0;
      }),
      smembers: jest.fn().mockImplementation(async (key: string) => {
        return Array.from(redisSets.get(key) ?? []);
      }),
      get: jest.fn().mockImplementation(async (key: string) => {
        return redisStrings.get(key) ?? null;
      }),
      ttl: jest.fn().mockImplementation(async (key: string) => {
        return redisStrings.has(key) ? 20 : 0;
      }),
      exists: jest.fn().mockImplementation(async (key: string) => {
        return redisStrings.has(key) ? 1 : 0;
      }),
      psubscribe: jest.fn().mockResolvedValue(1),
      config: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    eventPublisher = new EventPublisher() as jest.Mocked<EventPublisher>;
    eventPublisher.publish = jest.fn().mockResolvedValue(undefined);

    offerManager = new DriverOfferManager(mockRedis as any);
    rideService = new RideService(prisma, eventPublisher, offerManager);

    // Mock Prisma methods
    (prisma.ride as any) = {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };
  });

  afterEach(async () => {
    if (offerManager) {
      await offerManager.close();
    }
  });

  describe('Task 2.1: OFFERED Status with Timeout', () => {
    test('Should transition ride to OFFERED when offering to driver', async () => {
      const driverId = 'driver-1';
      
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(mockRide);
      (prisma.ride.update as jest.Mock).mockResolvedValue({
        ...mockRide,
        status: RideStatus.OFFERED,
        offeredAt: new Date(),
        reassignAttempts: 1,
      });

      await rideService.offerRideToDriver('ride-123', driverId, 20);

      // Verify status changed to OFFERED
      expect(prisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ride-123' },
          data: expect.objectContaining({
            status: RideStatus.OFFERED,
            offeredAt: expect.any(Date),
          }),
        })
      );

      // Verify Redis TTL was set
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ride:offer:ride-123',
        20,
        expect.stringContaining(`"driverId":"${driverId}"`)
      );

      // Verify event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.offered',
        expect.objectContaining({
          rideId: 'ride-123',
          driverId,
          ttlSeconds: 20,
        }),
        'ride-123'
      );
    });

    test('Should not offer to same driver twice', async () => {
      const driverId = 'driver-1';
      
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue({
        ...mockRide,
        offeredDriverIds: [driverId],
      });
      await mockRedis.sadd('ride:offered:ride-123', driverId);

      await expect(
        rideService.offerRideToDriver('ride-123', driverId, 20)
      ).rejects.toThrow('Driver has already been offered this ride');
    });

    test('Should handle offer timeout and transition back to FINDING_DRIVER', async () => {
      const driverId = 'driver-1';
      const offeredRide = {
        ...mockRide,
        status: RideStatus.OFFERED,
        driverId,
        offeredAt: new Date(),
        reassignAttempts: 1,
      };

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(offeredRide);
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);
      await mockRedis.setex(
        'ride:offer:ride-123',
        20,
        JSON.stringify({
          rideId: 'ride-123',
          driverId,
          offeredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 20_000).toISOString(),
        })
      );
      
      (prisma.ride.update as jest.Mock).mockResolvedValueOnce({
        ...offeredRide,
        status: RideStatus.FINDING_DRIVER,
        driverId: null,
        offeredAt: null,
        rejectedDriverIds: [driverId],
      });

      await rideService.handleOfferTimeout('ride-123');

      // Verify transitioned back to FINDING_DRIVER
      expect(prisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ride-123' },
          data: expect.objectContaining({
            status: RideStatus.FINDING_DRIVER,
            driverId: null,
            offeredAt: null,
          }),
        })
      );

      // Verify timeout event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.offer_timeout',
        expect.objectContaining({
          rideId: 'ride-123',
          timedOutDriverId: driverId,
        }),
        'ride-123'
      );
    });

    test('Should accept offer when driver responds within TTL', async () => {
      const driverId = 'driver-1';
      const offeredRide = {
        ...mockRide,
        status: RideStatus.OFFERED,
        driverId,
        offeredAt: new Date(),
      };

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(offeredRide);
      await mockRedis.setex(
        'ride:offer:ride-123',
        20,
        JSON.stringify({
          rideId: 'ride-123',
          driverId,
          offeredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 20_000).toISOString(),
        })
      );
      
      (prisma.ride.update as jest.Mock).mockResolvedValue({
        ...offeredRide,
        status: RideStatus.ASSIGNED,
      });

      await rideService.driverAcceptOfferedRide('ride-123', driverId);

      // Verify transitioned to ASSIGNED
      expect(prisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ride-123' },
          data: expect.objectContaining({
            status: RideStatus.ASSIGNED,
          }),
        })
      );

      // Verify Redis offer was removed
      expect(mockRedis.del).toHaveBeenCalledWith('ride:offer:ride-123');

      // Verify assigned event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.assigned',
        expect.any(Object),
        'ride-123'
      );
    });
  });

  describe('Task 2.2: Auto Re-assign Driver', () => {
    test('Should re-assign to different driver after timeout', async () => {
      const driver1 = 'driver-1';
      const offeredRide = {
        ...mockRide,
        status: RideStatus.OFFERED,
        driverId: driver1,
        offeredDriverIds: [driver1],
        rejectedDriverIds: [],
        reassignAttempts: 1,
        offeredAt: new Date(),
      };

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(offeredRide);
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);
      await mockRedis.setex(
        'ride:offer:ride-123',
        20,
        JSON.stringify({
          rideId: 'ride-123',
          driverId: driver1,
          offeredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 20_000).toISOString(),
        })
      );
      
      (prisma.ride.update as jest.Mock).mockResolvedValue({
        ...offeredRide,
        status: RideStatus.FINDING_DRIVER,
        driverId: null,
        offeredAt: null,
        rejectedDriverIds: [driver1],
      });

      await rideService.handleOfferTimeout('ride-123');

      // Verify reassignment request published with excluded driver
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.reassignment_requested',
        expect.objectContaining({
          rideId: 'ride-123',
          excludeDriverIds: expect.arrayContaining([driver1]),
        }),
        'ride-123'
      );
    });

    test('Should exclude all previously offered drivers from re-assignment', async () => {
      const driver1 = 'driver-1';
      const driver2 = 'driver-2';
      const offeredRide = {
        ...mockRide,
        status: RideStatus.FINDING_DRIVER,
        offeredDriverIds: [driver1, driver2],
        rejectedDriverIds: [driver1],
        reassignAttempts: 2,
      } as any;

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(offeredRide);

      await rideService.autoReassignDriver(offeredRide);

      // Verify both drivers are excluded
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.reassignment_requested',
        expect.objectContaining({
          excludeDriverIds: expect.arrayContaining([driver1, driver2]),
        }),
        'ride-123'
      );
    });

    test('Should stop re-assignment after max attempts', async () => {
      const offeredRide = {
        ...mockRide,
        status: RideStatus.FINDING_DRIVER,
        offeredDriverIds: ['driver-1', 'driver-2', 'driver-3'],
        rejectedDriverIds: ['driver-1', 'driver-2', 'driver-3'],
        reassignAttempts: 3,
      } as any;

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(offeredRide);

      await rideService.autoReassignDriver(offeredRide);

      // Verify no reassignment request published
      expect(eventPublisher.publish).not.toHaveBeenCalledWith(
        'ride.reassignment_requested',
        expect.any(Object)
      );

      // Verify max attempts event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.reassignment_failed',
        expect.objectContaining({
          rideId: 'ride-123',
          attempts: 3,
        }),
        'ride-123'
      );
    });

    test('Should handle driver manual rejection', async () => {
      const driverId = 'driver-1';
      const offeredRide = {
        ...mockRide,
        status: RideStatus.OFFERED,
        driverId,
        offeredAt: new Date(),
        reassignAttempts: 1,
      };

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(offeredRide);
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);
      
      (prisma.ride.update as jest.Mock).mockResolvedValue({
        ...offeredRide,
        status: RideStatus.FINDING_DRIVER,
        driverId: null,
        offeredAt: null,
        rejectedDriverIds: [driverId],
      });

      await rideService.driverRejectOffer('ride-123', driverId, 'Too far away');

      // Verify rejection event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.offer_rejected',
        expect.objectContaining({
          rideId: 'ride-123',
          driverId,
          reason: 'Too far away',
        }),
        'ride-123'
      );

      // Verify re-assignment triggered
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.reassignment_requested',
        expect.objectContaining({
          excludeDriverIds: expect.arrayContaining([driverId]),
        }),
        'ride-123'
      );
    });
  });

  describe('Integration Scenarios', () => {
    test('Scenario: Driver A timeout → Driver B timeout → Driver C accepts', async () => {
      const driverA = 'driver-A';
      const driverB = 'driver-B';
      const driverC = 'driver-C';

      // Initial state
      let currentRide: any = { ...mockRide };

      // Offer to Driver A
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(currentRide);
      currentRide = {
        ...currentRide,
        status: RideStatus.OFFERED,
        driverId: driverA,
        offeredDriverIds: [driverA],
        reassignAttempts: 1,
      };
      (prisma.ride.update as jest.Mock).mockResolvedValue(currentRide);

      await rideService.offerRideToDriver('ride-123', driverA, 20);

      // Driver A timeout
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(currentRide);
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);
      currentRide = {
        ...currentRide,
        status: RideStatus.FINDING_DRIVER,
        driverId: null,
        rejectedDriverIds: [driverA],
      };
      (prisma.ride.update as jest.Mock).mockResolvedValue(currentRide);

      await rideService.handleOfferTimeout('ride-123');

      // Offer to Driver B
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(currentRide);
      currentRide = {
        ...currentRide,
        status: RideStatus.OFFERED,
        driverId: driverB,
        offeredDriverIds: [driverA, driverB],
        reassignAttempts: 2,
      };
      (prisma.ride.update as jest.Mock).mockResolvedValue(currentRide);

      await rideService.offerRideToDriver('ride-123', driverB, 20);

      // Driver B timeout
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(currentRide);
      currentRide = {
        ...currentRide,
        status: RideStatus.FINDING_DRIVER,
        driverId: null,
        rejectedDriverIds: [driverA, driverB],
      };
      (prisma.ride.update as jest.Mock).mockResolvedValue(currentRide);

      await rideService.handleOfferTimeout('ride-123');

      // Offer to Driver C
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(currentRide);
      currentRide = {
        ...currentRide,
        status: RideStatus.OFFERED,
        driverId: driverC,
        offeredDriverIds: [driverA, driverB, driverC],
        reassignAttempts: 3,
      };
      (prisma.ride.update as jest.Mock).mockResolvedValue(currentRide);

      await rideService.offerRideToDriver('ride-123', driverC, 20);

      // Driver C accepts
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(currentRide);
      currentRide = {
        ...currentRide,
        status: RideStatus.ASSIGNED,
      };
      (prisma.ride.update as jest.Mock).mockResolvedValue(currentRide);

      await rideService.driverAcceptOfferedRide('ride-123', driverC);

      // Verify final state
      expect(currentRide.status).toBe(RideStatus.ASSIGNED);
      expect(currentRide.driverId).toBe(driverC);
      expect(currentRide.offeredDriverIds).toContain(driverA);
      expect(currentRide.offeredDriverIds).toContain(driverB);
      expect(currentRide.offeredDriverIds).toContain(driverC);
      expect(currentRide.rejectedDriverIds).toContain(driverA);
      expect(currentRide.rejectedDriverIds).toContain(driverB);
    });

    test('Scenario: Cannot offer to already rejected driver', async () => {
      const driverId = 'driver-1';
      const rideWithRejected = {
        ...mockRide,
        status: RideStatus.FINDING_DRIVER,
        offeredDriverIds: [driverId],
        rejectedDriverIds: [driverId],
      };

      (prisma.ride.findUnique as jest.Mock).mockResolvedValue(rideWithRejected);
      await mockRedis.sadd('ride:offered:ride-123', driverId);

      await expect(
        rideService.offerRideToDriver('ride-123', driverId, 20)
      ).rejects.toThrow('Driver has already been offered this ride');
    });
  });
});
