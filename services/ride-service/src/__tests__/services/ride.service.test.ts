import { RideStatus } from '@prisma/client';

jest.mock('uuid', () => ({
  v4: () => 'ride-1',
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

type PrismaClientLike = {
  ride: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

describe('RideService (Application/use-case)', () => {
  let prisma: PrismaClientLike;
  let eventPublisher: { publish: jest.Mock };
  let RideService: any;
  let service: any;

  beforeEach(() => {
    prisma = {
      ride: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    eventPublisher = { publish: jest.fn() };

    ({ RideService } = require('../../services/ride.service'));
    service = new RideService(prisma as any, eventPublisher as any);

    jest.clearAllMocks();
  });

  describe('createRide', () => {
    it('uses AI estimate (destination + duration_minutes->seconds), creates ride, publishes events', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          surge_multiplier: 1.5,
          estimated_fare: 123000,
          distance_km: 8.2,
          duration_minutes: 12,
        },
      });

      prisma.ride.create.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.PENDING,
        pickupAddress: 'A',
        pickupLat: 10,
        pickupLng: 106,
        dropoffAddress: 'B',
        dropoffLat: 10.5,
        dropoffLng: 106.5,
        distance: 8.2,
        duration: 12 * 60,
        fare: 123000,
        surgeMultiplier: 1.5,
      });

      const ride = await service.createRide({
        customerId: 'cust-1',
        pickup: { address: 'A', lat: 10, lng: 106 },
        dropoff: { address: 'B', lat: 10.5, lng: 106.5 },
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/ride/estimate'),
        {
          pickup: { lat: 10, lng: 106 },
          destination: { lat: 10.5, lng: 106.5 },
        },
        expect.objectContaining({ timeout: 800 })
      );

      expect(prisma.ride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'ride-1',
            customerId: 'cust-1',
            status: RideStatus.PENDING,
            distance: 8.2,
            duration: 12 * 60,
            fare: 123000,
            surgeMultiplier: 1.5,
            transitions: {
              create: expect.objectContaining({
                fromStatus: null,
                toStatus: RideStatus.PENDING,
                actorId: 'cust-1',
                actorType: 'CUSTOMER',
              }),
            },
          }),
        })
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.created',
        expect.objectContaining({
          rideId: 'ride-1',
          customerId: 'cust-1',
          estimatedFare: 123000,
          surgeMultiplier: 1.5,
        }),
        'ride-1'
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.assignment.requested',
        expect.objectContaining({
          rideId: 'ride-1',
          customerId: 'cust-1',
          pickup: { lat: 10, lng: 106 },
          searchRadiusKm: expect.any(Number),
        }),
        'ride-1'
      );

      expect(ride.id).toBe('ride-1');
    });

    it('falls back when AI unavailable and still publishes events', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('timeout'));

      prisma.ride.create.mockImplementation(async ({ data }: any) => ({
        ...data,
        id: data.id,
        status: data.status,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
      }));

      const ride = await service.createRide({
        customerId: 'cust-1',
        pickup: { address: 'A', lat: 10, lng: 106 },
        dropoff: { address: 'B', lat: 10.5, lng: 106.5 },
      });

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(prisma.ride.create).toHaveBeenCalledTimes(1);

      const createArg = prisma.ride.create.mock.calls[0][0];
      expect(createArg.data.distance).toEqual(expect.any(Number));
      expect(createArg.data.duration).toEqual(expect.any(Number));
      expect(createArg.data.fare).toEqual(expect.any(Number));

      expect(eventPublisher.publish).toHaveBeenCalledWith('ride.created', expect.any(Object), 'ride-1');
      expect(eventPublisher.publish).toHaveBeenCalledWith('ride.assignment.requested', expect.any(Object), 'ride-1');

      expect(ride.id).toBe('ride-1');
    });
  });

  describe('assign/accept/reject/start/complete', () => {
    it('assignDriver: PENDING -> ASSIGNED and publishes ride.assigned', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.PENDING,
        pickupLat: 10,
        pickupLng: 106,
      });

      prisma.ride.update.mockResolvedValue({ id: 'ride-1', status: RideStatus.ASSIGNED, driverId: 'drv-1' });

      const ride = await service.assignDriver('ride-1', 'drv-1');

      expect(prisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ride-1' },
          data: expect.objectContaining({
            status: RideStatus.ASSIGNED,
            driverId: 'drv-1',
            assignedAt: expect.any(Date),
          }),
        })
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.assigned',
        expect.objectContaining({
          rideId: 'ride-1',
          driverId: 'drv-1',
          customerId: 'cust-1',
          pickup: { lat: 10, lng: 106 },
        }),
        'ride-1'
      );

      expect(ride.status).toBe(RideStatus.ASSIGNED);
    });

    it('acceptRide: throws if driverId mismatch', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.ASSIGNED,
        driverId: 'drv-OTHER',
      });

      await expect(service.acceptRide('ride-1', 'drv-1')).rejects.toThrow('Driver not assigned to this ride');
    });

    it('acceptRide: ASSIGNED -> ACCEPTED and publishes ride.accepted', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.ASSIGNED,
        driverId: 'drv-1',
      });

      prisma.ride.update.mockResolvedValue({ id: 'ride-1', status: RideStatus.ACCEPTED, driverId: 'drv-1' });

      const ride = await service.acceptRide('ride-1', 'drv-1');

      expect(prisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ride-1' },
          data: expect.objectContaining({
            status: RideStatus.ACCEPTED,
            acceptedAt: expect.any(Date),
          }),
        })
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.accepted',
        expect.objectContaining({ rideId: 'ride-1', driverId: 'drv-1', customerId: 'cust-1' }),
        'ride-1'
      );

      expect(ride.status).toBe(RideStatus.ACCEPTED);
    });

    it('rejectRide: clears driver and goes back to PENDING then requests assignment', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.ASSIGNED,
        driverId: 'drv-1',
        pickupLat: 10,
        pickupLng: 106,
      });

      prisma.ride.update.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.PENDING,
        driverId: null,
        pickupLat: 10,
        pickupLng: 106,
      });

      const ride = await service.rejectRide('ride-1', 'drv-1');

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.rejected',
        expect.objectContaining({ rideId: 'ride-1', driverId: 'drv-1', customerId: 'cust-1' }),
        'ride-1'
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.assignment.requested',
        expect.objectContaining({ rideId: 'ride-1', customerId: 'cust-1' }),
        'ride-1'
      );

      expect(ride.status).toBe(RideStatus.PENDING);
      expect(ride.driverId).toBeNull();
    });

    it('startRide: ACCEPTED -> IN_PROGRESS', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.ACCEPTED,
        driverId: 'drv-1',
      });

      prisma.ride.update.mockResolvedValue({ id: 'ride-1', status: RideStatus.IN_PROGRESS, driverId: 'drv-1' });

      const ride = await service.startRide('ride-1', 'drv-1');

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.started',
        expect.objectContaining({ rideId: 'ride-1', driverId: 'drv-1', customerId: 'cust-1' }),
        'ride-1'
      );
      expect(ride.status).toBe(RideStatus.IN_PROGRESS);
    });

    it('completeRide: IN_PROGRESS -> COMPLETED and publishes ride.completed with fare/distance/duration', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.IN_PROGRESS,
        driverId: 'drv-1',
        fare: 50000,
        distance: 3.2,
        duration: 600,
      });

      prisma.ride.update.mockResolvedValue({ id: 'ride-1', status: RideStatus.COMPLETED, driverId: 'drv-1' });

      const ride = await service.completeRide('ride-1', 'drv-1');

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.completed',
        expect.objectContaining({
          rideId: 'ride-1',
          driverId: 'drv-1',
          customerId: 'cust-1',
          fare: 50000,
          distance: 3.2,
          duration: 600,
        }),
        'ride-1'
      );

      expect(ride.status).toBe(RideStatus.COMPLETED);
    });
  });

  describe('cancelRide', () => {
    it('throws if ride not cancellable', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.IN_PROGRESS,
        driverId: 'drv-1',
      });

      await expect(service.cancelRide('ride-1', 'cust-1', 'CUSTOMER')).rejects.toThrow(
        'Ride cannot be cancelled in current state'
      );
    });

    it('throws if customer tries to cancel someone else\'s ride', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-OTHER',
        status: RideStatus.PENDING,
        driverId: null,
      });

      await expect(service.cancelRide('ride-1', 'cust-1', 'CUSTOMER')).rejects.toThrow(
        'Customer can only cancel their own ride'
      );
    });

    it('cancels ride and publishes ride.cancelled', async () => {
      prisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        customerId: 'cust-1',
        status: RideStatus.ASSIGNED,
        driverId: 'drv-1',
      });

      prisma.ride.update.mockResolvedValue({ id: 'ride-1', status: RideStatus.CANCELLED });

      const ride = await service.cancelRide('ride-1', 'cust-1', 'CUSTOMER', 'Changed my mind');

      expect(prisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ride-1' },
          data: expect.objectContaining({
            status: RideStatus.CANCELLED,
            cancelledAt: expect.any(Date),
            cancelReason: 'Changed my mind',
            cancelledBy: 'CUSTOMER',
          }),
        })
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'ride.cancelled',
        expect.objectContaining({
          rideId: 'ride-1',
          customerId: 'cust-1',
          driverId: 'drv-1',
          cancelledBy: 'CUSTOMER',
          reason: 'Changed my mind',
        }),
        'ride-1'
      );

      expect(ride.status).toBe(RideStatus.CANCELLED);
    });
  });
});
