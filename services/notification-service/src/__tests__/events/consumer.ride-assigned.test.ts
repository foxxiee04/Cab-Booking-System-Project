jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('EventConsumer handleRideAssigned (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
    process.env.AUTH_SERVICE_URL = 'http://auth-service:3001';
    process.env.RIDE_SERVICE_URL = 'http://ride-service:3002';
    process.env.DRIVER_SERVICE_URL = 'http://driver-service:3003';
  });

  it('enriches via internal APIs then emits to customer + driver', async () => {
    const axios = require('axios');

    // ride -> driver -> user
    axios.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            ride: {
              pickupLat: 10,
              pickupLng: 106,
              pickupAddress: 'Pickup A',
              dropoffLat: 10.5,
              dropoffLng: 106.5,
              dropoffAddress: 'Dropoff B',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            driver: {
              userId: 'user-1',
              vehicle: { plate: '59A-12345' },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            user: {
              email: 'driver@example.com',
              phone: '0900000000',
              profile: { firstName: 'A', lastName: 'B' },
            },
          },
        },
      });

    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideAssigned({
      rideId: 'ride-1',
      driverId: 'drv-1',
      customerId: 'cust-1',
      pickup: { lat: 0, lng: 0 },
      dropoff: { lat: 0, lng: 0 },
    });

    // allow the async IIFE to complete
    await new Promise((r) => setTimeout(r, 0));

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'http://ride-service:3002/internal/rides/ride-1',
      expect.objectContaining({ headers: { 'x-internal-token': 'internal-test-token' }, timeout: 1500 })
    );

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'http://driver-service:3003/internal/drivers/by-user/drv-1',
      expect.objectContaining({ headers: { 'x-internal-token': 'internal-test-token' }, timeout: 1500 })
    );

    expect(axios.get).toHaveBeenNthCalledWith(
      3,
      'http://auth-service:3001/internal/users/user-1',
      expect.objectContaining({ headers: { 'x-internal-token': 'internal-test-token' }, timeout: 1500 })
    );

    // customer event
    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'cust-1',
      'ride:driver_assigned',
      expect.objectContaining({
        rideId: 'ride-1',
        driverId: 'drv-1',
        driverName: 'A B',
        driverPhone: '0900000000',
        vehicleInfo: { plate: '59A-12345' },
        pickup: { lat: 10, lng: 106, address: 'Pickup A' },
        dropoff: { lat: 10.5, lng: 106.5, address: 'Dropoff B' },
      })
    );

    // driver event
    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'drv-1',
      'ride:assigned',
      expect.objectContaining({
        rideId: 'ride-1',
        customerId: 'cust-1',
        pickup: { lat: 10, lng: 106, address: 'Pickup A' },
        dropoff: { lat: 10.5, lng: 106.5, address: 'Dropoff B' },
      })
    );
  });
});
