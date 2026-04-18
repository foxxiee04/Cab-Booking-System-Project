import { EventConsumer } from '../../events/consumer';
import { SocketServer } from '../../socket/socket-server';
import { driverGrpcClient } from '../../grpc/driver.client';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('amqplib');
jest.mock('../../socket/socket-server');
jest.mock('../../grpc/driver.client', () => ({
  driverGrpcClient: {
    getDriverById: jest.fn(),
    getDriverFullProfile: jest.fn(),
  },
}));

describe('EventConsumer', () => {
  let eventConsumer: EventConsumer;
  let mockSocketServer: jest.Mocked<SocketServer>;
  let mockRedis: jest.Mocked<Redis>;
  const mockDriverGrpc = driverGrpcClient as jest.Mocked<typeof driverGrpcClient>;

  beforeEach(() => {
    // Create mock instances
    mockSocketServer = {
      emitToCustomer: jest.fn(),
      emitToDriver: jest.fn(),
      emitToDrivers: jest.fn(),
      isUserOnline: jest.fn(),
      isUserOnlineRedis: jest.fn(),
    } as any;

    mockRedis = {
      georadius: jest.fn(),
      hgetall: jest.fn(),
      hset: jest.fn(),
      hincrby: jest.fn(),
      quit: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);
    mockRedis.hgetall.mockResolvedValue({} as any);
    mockRedis.hset.mockResolvedValue(1 as any);
    mockRedis.hincrby.mockResolvedValue(1 as any);
    mockDriverGrpc.getDriverById.mockReset();
    mockDriverGrpc.getDriverFullProfile.mockReset();

    eventConsumer = new EventConsumer(mockSocketServer);
  });

  describe('Matching Events', () => {
    it('should handle ride.finding_driver_requested and notify nearby online drivers', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', '500'],
        ['driver-2', '1200'],
        ['driver-3', '2500'],
      ] as any);

      mockDriverGrpc.getDriverById
        .mockResolvedValueOnce({ id: 'driver-1', userId: 'user-1', ratingAverage: 4.9 } as any)
        .mockResolvedValueOnce({ id: 'driver-2', userId: 'user-2', ratingAverage: 4.8 } as any)
        .mockResolvedValueOnce({ id: 'driver-3', userId: 'user-3', ratingAverage: 4.7 } as any);

      mockSocketServer.isUserOnline.mockImplementation((userId: string) => userId !== 'user-2');
      mockSocketServer.isUserOnlineRedis.mockResolvedValue(false);

      const payload = {
        rideId: 'ride-123',
        customerId: 'customer-456',
        pickup: {
          address: '123 Main St',
          lat: 10.762622,
          lng: 106.660172,
        },
        dropoff: {
          address: '456 Second St',
          lat: 10.772622,
          lng: 106.670172,
        },
        fare: 50.5,
        distance: 5.2,
        searchRadiusKm: 5,
      };

      await (eventConsumer as any).handleMatchingRequested(payload);

      expect(mockRedis.georadius).toHaveBeenCalledWith(
        'drivers:geo:online',
        106.660172,
        10.762622,
        2000,
        'm',
        'WITHDIST',
        'ASC'
      );

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-1',
        'NEW_RIDE_AVAILABLE',
        expect.objectContaining({
          rideId: 'ride-123',
          customerId: 'customer-456',
          estimatedFare: 51,
          searchRadiusKm: 2,
        })
      );
    });

    it('should exclude drivers that were already tried during reassignment', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', '500'],
        ['driver-2', '1200'],
        ['driver-3', '2500'],
      ] as any);

      mockDriverGrpc.getDriverById
        .mockResolvedValueOnce({ id: 'driver-1', userId: 'user-1', ratingAverage: 4.9 } as any)
        .mockResolvedValueOnce({ id: 'driver-3', userId: 'user-3', ratingAverage: 4.7 } as any);

      mockSocketServer.isUserOnline.mockReturnValue(true);
      mockSocketServer.isUserOnlineRedis.mockResolvedValue(false);

      const payload = {
        rideId: 'ride-456',
        customerId: 'customer-789',
        pickup: {
          lat: 10.762622,
          lng: 106.660172,
        },
        excludeDriverIds: ['driver-2'],
      };

      await (eventConsumer as any).handleMatchingRequested(payload);

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-1',
        'NEW_RIDE_AVAILABLE',
        expect.any(Object)
      );

      expect(mockDriverGrpc.getDriverById).toHaveBeenCalledTimes(2);
    });

    it('should deliver a targeted ride offer to the resolved driver socket room', async () => {
      mockDriverGrpc.getDriverById.mockResolvedValueOnce({ id: 'driver-999', userId: 'user-999' } as any);

      await (eventConsumer as any).handleRideOffered({
        rideId: 'ride-offer-1',
        driverId: 'driver-999',
        customerId: 'customer-1',
        pickup: { lat: 10.7, lng: 106.6, address: 'Pickup' },
        dropoff: { lat: 10.8, lng: 106.7, address: 'Dropoff' },
        fare: 120000,
        ttlSeconds: 20,
      });

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-999',
        'NEW_RIDE_AVAILABLE',
        expect.objectContaining({
          rideId: 'ride-offer-1',
          timeoutSeconds: 20,
          estimatedFare: 120000,
        })
      );
    });

    it('should handle no nearby drivers gracefully', async () => {
      mockRedis.georadius.mockResolvedValue([]);

      const payload = {
        rideId: 'ride-lonely',
        customerId: 'customer-sad',
        pickup: {
          lat: 11.0,
          lng: 107.0,
        },
      };

      await (eventConsumer as any).handleMatchingRequested(payload);

      expect(mockSocketServer.emitToDrivers).not.toHaveBeenCalled();
    });
  });

  describe('Ride Status Events', () => {
    it('should fan out driver approval updates to the driver room', async () => {
      await (eventConsumer as any).handleDriverApprovalUpdated({
        driverId: 'driver-1',
        userId: 'user-1',
        status: 'APPROVED',
      });

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-1',
        'DRIVER_APPROVAL_UPDATED',
        expect.objectContaining({
          driverId: 'driver-1',
          status: 'APPROVED',
        })
      );
    });

    it('should handle ride.accepted and notify customer', async () => {
      mockDriverGrpc.getDriverFullProfile.mockResolvedValueOnce({
        id: 'driver-789',
        userId: 'user-789',
        firstName: 'Driver',
        lastName: 'Accepted',
      } as any);
      mockDriverGrpc.getDriverById.mockResolvedValueOnce({ id: 'driver-789', userId: 'user-789' } as any);

      const payload = {
        rideId: 'ride-123',
        customerId: 'customer-456',
        driverId: 'driver-789',
        status: 'ACCEPTED',
      };

      await (eventConsumer as any).handleRideAccepted(payload);

      expect(mockSocketServer.emitToCustomer).toHaveBeenCalledWith(
        'customer-456',
        'RIDE_STATUS_UPDATE',
        expect.objectContaining({
          rideId: 'ride-123',
          status: 'ACCEPTED',
          driverId: 'driver-789',
        })
      );

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-789',
        'ride:status',
        expect.objectContaining({
          rideId: 'ride-123',
          status: 'ACCEPTED',
        })
      );
    });

    it('should handle ride.picking_up and notify both parties', async () => {
      mockDriverGrpc.getDriverById.mockResolvedValueOnce({ id: 'driver-900', userId: 'user-900' } as any);

      const payload = {
        rideId: 'ride-pickup-1',
        customerId: 'customer-100',
        driverId: 'driver-900',
        status: 'PICKING_UP',
      };

      await (eventConsumer as any).handleRidePickingUp(payload);

      expect(mockSocketServer.emitToCustomer).toHaveBeenCalledWith(
        'customer-100',
        'RIDE_STATUS_UPDATE',
        expect.objectContaining({
          rideId: 'ride-pickup-1',
          status: 'PICKING_UP',
          driverId: 'driver-900',
        })
      );

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-900',
        'ride:status',
        expect.objectContaining({
          rideId: 'ride-pickup-1',
          status: 'PICKING_UP',
        })
      );
    });

    it('should handle ride.started and notify both parties', async () => {
      mockDriverGrpc.getDriverById.mockResolvedValueOnce({ id: 'driver-222', userId: 'user-222' } as any);

      const payload = {
        rideId: 'ride-456',
        customerId: 'customer-111',
        driverId: 'driver-222',
        status: 'IN_PROGRESS',
      };

      await (eventConsumer as any).handleRideStarted(payload);

      expect(mockSocketServer.emitToCustomer).toHaveBeenCalledWith(
        'customer-111',
        'RIDE_STATUS_UPDATE',
        expect.objectContaining({
          rideId: 'ride-456',
          status: 'IN_PROGRESS',
        })
      );

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-222',
        'ride:status',
        expect.objectContaining({
          rideId: 'ride-456',
          status: 'IN_PROGRESS',
        })
      );
    });

    it('should handle ride.completed with fare info', async () => {
      mockDriverGrpc.getDriverById.mockResolvedValueOnce({ id: 'driver-444', userId: 'user-444' } as any);

      const payload = {
        rideId: 'ride-789',
        customerId: 'customer-333',
        driverId: 'driver-444',
        status: 'COMPLETED',
        fare: 45.5,
        distance: 8.2,
        duration: 15,
      };

      await (eventConsumer as any).handleRideCompleted(payload);

      expect(mockSocketServer.emitToCustomer).toHaveBeenCalledWith(
        'customer-333',
        'RIDE_COMPLETED',
        expect.objectContaining({
          rideId: 'ride-789',
          status: 'COMPLETED',
          fare: 45.5,
          distance: 8.2,
          duration: 15,
        })
      );

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-444',
        'ride:status',
        expect.objectContaining({
          rideId: 'ride-789',
          status: 'COMPLETED',
        })
      );
    });

    it('should handle ride.cancelled and notify both parties', async () => {
      mockDriverGrpc.getDriverById.mockResolvedValueOnce({ id: 'driver-666', userId: 'user-666' } as any);

      const payload = {
        rideId: 'ride-cancel',
        customerId: 'customer-555',
        driverId: 'driver-666',
        status: 'CANCELLED',
      };

      await (eventConsumer as any).handleRideCancelled(payload);

      expect(mockSocketServer.emitToCustomer).toHaveBeenCalledWith(
        'customer-555',
        'RIDE_STATUS_UPDATE',
        expect.objectContaining({
          rideId: 'ride-cancel',
          status: 'CANCELLED',
        })
      );

      expect(mockSocketServer.emitToDriver).toHaveBeenCalledWith(
        'user-666',
        'ride:cancelled',
        expect.objectContaining({
          rideId: 'ride-cancel',
        })
      );
    });

    it('should handle ride.cancelled without driver assignment', async () => {
      const payload = {
        rideId: 'ride-early-cancel',
        customerId: 'customer-777',
        status: 'CANCELLED',
      };

      await (eventConsumer as any).handleRideCancelled(payload);

      expect(mockSocketServer.emitToCustomer).toHaveBeenCalledWith(
        'customer-777',
        'RIDE_STATUS_UPDATE',
        expect.any(Object)
      );

      // Should not notify driver if not assigned
      expect(mockSocketServer.emitToDriver).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully', async () => {
      mockRedis.georadius.mockRejectedValue(new Error('Redis connection failed'));

      const payload = {
        rideId: 'ride-error',
        customerId: 'customer-error',
        pickup: {
          lat: 10.0,
          lng: 106.0,
        },
      };

      await expect((eventConsumer as any).handleMatchingRequested(payload)).resolves.not.toThrow();

      expect(mockSocketServer.emitToDrivers).not.toHaveBeenCalled();
    });
  });
});
