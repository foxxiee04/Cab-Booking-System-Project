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

    // Create mocked instances
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      sismember: jest.fn().mockResolvedValue(0),
      smembers: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(null),
      config: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;

    Redis.prototype = mockRedis as any;

    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    eventPublisher = new EventPublisher() as jest.Mocked<EventPublisher>;
    eventPublisher.publish = jest.fn().mockResolvedValue(undefined);

    offerManager = new DriverOfferManager();
    rideService = new RideService(prisma, eventPublisher, offerManager);

    // Mock Prisma methods
    (prisma.ride as any) = {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };
  });

  afterEach(async () => {
    await offerManager.close();
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
        driverId
      );

      // Verify event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.offered',
        expect.objectContaining({
          rideId: 'ride-123',
          driverId,
          ttlSeconds: 20,
        })
      );
    });

    test('Should not offer to same driver twice', async () => {
      const driverId = 'driver-1';
      
      (prisma.ride.findUnique as jest.Mock).mockResolvedValue({
        ...mockRide,
        offeredDriverIds: [driverId],
      });

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
      (mockRedis.get as jest.Mock).mockResolvedValue(driverId);
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);
      
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
          driverId,
        })
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
      (mockRedis.get as jest.Mock).mockResolvedValue(driverId);
      
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
        expect.any(Object)
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
      (mockRedis.get as jest.Mock).mockResolvedValue(driver1);
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);
      
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
        })
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
        })
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
        'ride.max_reassignment_attempts',
        expect.objectContaining({
          rideId: 'ride-123',
          attempts: 3,
        })
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
        })
      );

      // Verify re-assignment triggered
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.reassignment_requested',
        expect.objectContaining({
          excludeDriverIds: expect.arrayContaining([driverId]),
        })
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
      (mockRedis.get as jest.Mock).mockResolvedValue(driverA);
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
      (mockRedis.get as jest.Mock).mockResolvedValue(driverB);
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
      (mockRedis.get as jest.Mock).mockResolvedValue(driverC);
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

      await expect(
        rideService.offerRideToDriver('ride-123', driverId, 20)
      ).rejects.toThrow('Driver has already been offered this ride');
    });
  });
});
