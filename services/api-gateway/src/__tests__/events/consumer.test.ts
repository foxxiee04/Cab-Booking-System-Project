import { EventConsumer } from '../../events/consumer';
import { SocketServer } from '../../socket/socket-server';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('amqplib');
jest.mock('../../socket/socket-server');

describe('EventConsumer', () => {
  let eventConsumer: EventConsumer;
  let mockSocketServer: jest.Mocked<SocketServer>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Create mock instances
    mockSocketServer = {
      emitToCustomer: jest.fn(),
      emitToDriver: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToCustomerAndDriver: jest.fn(),
      isUserOnline: jest.fn(),
    } as any;

    mockRedis = {
      georadius: jest.fn(),
      quit: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    eventConsumer = new EventConsumer(mockSocketServer);
  });

  describe('Booking Events', () => {
    it('should handle booking.created and notify nearby drivers', async () => {
      // Mock Redis georadius to return nearby drivers
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', '500'],
        ['driver-2', '1200'],
        ['driver-3', '2500'],
      ] as any);

      // Mock socket server to show all drivers are online
      mockSocketServer.isUserOnline.mockReturnValue(true);

      // Simulate booking.created event
      const payload = {
        bookingId: 'booking-123',
        customerId: 'customer-456',
        pickup: {
          address: '123 Main St',
          geoPoint: { lat: 10.762622, lng: 106.660172 },
        },
        dropoff: {
          address: '456 Second St',
          geoPoint: { lat: 10.772622, lng: 106.670172 },
        },
        estimatedFare: 50.5,
        estimatedDistance: 5.2,
        createdAt: new Date().toISOString(),
      };

      // Access private method through any type
      await (eventConsumer as any).handleBookingCreated(payload);

      // Verify Redis was queried for nearby drivers
      expect(mockRedis.georadius).toHaveBeenCalledWith(
        'driver-locations',
        106.660172,
        10.762622,
        5000,
        'm',
        'WITHDIST'
      );

      // Verify notification was sent to drivers
      expect(mockSocketServer.emitToDrivers).toHaveBeenCalledWith(
        ['driver-1', 'driver-2', 'driver-3'],
        'NEW_RIDE_AVAILABLE',
        expect.objectContaining({
          bookingId: 'booking-123',
          customerId: 'customer-456',
          estimatedFare: 50.5,
        })
      );
    });

    it('should filter out offline drivers', async () => {
      // Mock Redis to return 3 drivers
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', '500'],
        ['driver-2', '1200'],
        ['driver-3', '2500'],
      ] as any);

      // Only driver-1 and driver-3 are online
      mockSocketServer.isUserOnline.mockImplementation((userId: string) => {
        return userId === 'driver-1' || userId === 'driver-3';
      });

      const payload = {
        bookingId: 'booking-456',
        customerId: 'customer-789',
        pickup: {
          address: '123 Main St',
          geoPoint: { lat: 10.762622, lng: 106.660172 },
        },
        dropoff: {
          address: '456 Second St',
          geoPoint: { lat: 10.772622, lng: 106.670172 },
        },
        estimatedFare: 30.0,
        estimatedDistance: 3.5,
        createdAt: new Date().toISOString(),
      };

      await (eventConsumer as any).handleBookingCreated(payload);

      // Should only notify online drivers
      expect(mockSocketServer.emitToDrivers).toHaveBeenCalledWith(
        ['driver-1', 'driver-3'],
        'NEW_RIDE_AVAILABLE',
        expect.any(Object)
      );
    });

    it('should handle no nearby drivers gracefully', async () => {
      // Mock Redis to return no drivers
      mockRedis.georadius.mockResolvedValue([]);

      const payload = {
        bookingId: 'booking-lonely',
        customerId: 'customer-sad',
        pickup: {
          address: 'Remote Location',
          geoPoint: { lat: 11.0, lng: 107.0 },
        },
        dropoff: {
          address: 'Another Remote Location',
          geoPoint: { lat: 11.1, lng: 107.1 },
        },
        estimatedFare: 100.0,
        estimatedDistance: 20.0,
        createdAt: new Date().toISOString(),
      };

      await (eventConsumer as any).handleBookingCreated(payload);

      // Should not call emitToDrivers when no drivers found
      expect(mockSocketServer.emitToDrivers).not.toHaveBeenCalled();
    });
  });

  describe('Ride Status Events', () => {
    it('should handle ride.accepted and notify customer', async () => {
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
        'driver-789',
        'RIDE_STATUS_UPDATE',
        expect.any(Object)
      );
    });

    it('should handle ride.started and notify both parties', async () => {
      const payload = {
        rideId: 'ride-456',
        customerId: 'customer-111',
        driverId: 'driver-222',
        status: 'IN_PROGRESS',
      };

      await (eventConsumer as any).handleRideStarted(payload);

      expect(mockSocketServer.emitToCustomerAndDriver).toHaveBeenCalledWith(
        'customer-111',
        'driver-222',
        'RIDE_STATUS_UPDATE',
        expect.objectContaining({
          rideId: 'ride-456',
          status: 'IN_PROGRESS',
        })
      );
    });

    it('should handle ride.completed with fare info', async () => {
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

      expect(mockSocketServer.emitToCustomerAndDriver).toHaveBeenCalledWith(
        'customer-333',
        'driver-444',
        'RIDE_COMPLETED',
        expect.objectContaining({
          rideId: 'ride-789',
          status: 'COMPLETED',
          fare: 45.5,
          distance: 8.2,
          duration: 15,
        })
      );
    });

    it('should handle ride.cancelled and notify both parties', async () => {
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
        'driver-666',
        'RIDE_STATUS_UPDATE',
        expect.any(Object)
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
        bookingId: 'booking-error',
        customerId: 'customer-error',
        pickup: {
          address: 'Test',
          geoPoint: { lat: 10.0, lng: 106.0 },
        },
        dropoff: {
          address: 'Test2',
          geoPoint: { lat: 10.1, lng: 106.1 },
        },
        estimatedFare: 20.0,
        estimatedDistance: 2.0,
        createdAt: new Date().toISOString(),
      };

      // Should not throw error
      await expect((eventConsumer as any).handleBookingCreated(payload)).resolves.not.toThrow();

      // Should not emit when error occurs
      expect(mockSocketServer.emitToDrivers).not.toHaveBeenCalled();
    });
  });
});
