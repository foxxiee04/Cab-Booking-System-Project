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

describe('EventConsumer handler emits (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('handleRideCreated: emits to customer', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideCreated({
      rideId: 'ride-1',
      customerId: 'cust-1',
    });

    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'cust-1',
      'ride:created',
      expect.objectContaining({
        rideId: 'ride-1',
        status: 'PENDING',
      })
    );
  });

  it('handlePaymentCompleted: emits to customer and driver', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handlePaymentCompleted({
      rideId: 'ride-1',
      customerId: 'cust-1',
      driverId: 'drv-1',
      amount: 50000,
    });

    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'cust-1',
      'payment:completed',
      expect.objectContaining({ rideId: 'ride-1', amount: 50000 })
    );

    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'drv-1',
      'payment:received',
      expect.objectContaining({ rideId: 'ride-1', amount: 50000 })
    );
  });

  it('handlePaymentFailed: emits to customer', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handlePaymentFailed({
      rideId: 'ride-1',
      customerId: 'cust-1',
      reason: 'timeout',
    });

    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'cust-1',
      'payment:failed',
      expect.objectContaining({
        rideId: 'ride-1',
        reason: 'timeout',
      })
    );
  });

  it('handleRideAccepted: emits to customer', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideAccepted({
      rideId: 'ride-1',
      customerId: 'cust-1',
      driverId: 'drv-1',
      eta: 5,
    });

    expect(socketManager.emitToUser).toHaveBeenCalledWith(
      'cust-1',
      'ride:accepted',
      expect.objectContaining({
        rideId: 'ride-1',
        driverId: 'drv-1',
        eta: 5,
      })
    );
  });

  it('handleRideCompleted: emits to ride room', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideCompleted({
      rideId: 'ride-1',
      fare: 50000,
      distance: 3.2,
      duration: 600,
      completedAt: 'now',
    });

    expect(socketManager.emitToRide).toHaveBeenCalledWith(
      'ride-1',
      'ride:completed',
      expect.objectContaining({
        rideId: 'ride-1',
        fare: 50000,
        distance: 3.2,
        duration: 600,
      })
    );
  });

  it('handleRideStarted: emits to ride room', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideStarted({
      rideId: 'ride-1',
      startedAt: 'now',
    });

    expect(socketManager.emitToRide).toHaveBeenCalledWith(
      'ride-1',
      'ride:started',
      expect.objectContaining({
        rideId: 'ride-1',
        startedAt: 'now',
      })
    );
  });

  it('handleRideCancelled: emits to ride room', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideCancelled({
      rideId: 'ride-1',
      reason: 'Changed my mind',
      cancelledBy: 'CUSTOMER',
    });

    expect(socketManager.emitToRide).toHaveBeenCalledWith(
      'ride-1',
      'ride:cancelled',
      expect.objectContaining({ rideId: 'ride-1', reason: 'Changed my mind', cancelledBy: 'CUSTOMER' })
    );
  });

  it('handleRideAssignmentRequested: broadcasts new request to drivers', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleRideAssignmentRequested({
      rideId: 'ride-1',
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 10.5, lng: 106.5 },
      estimatedFare: 50000,
    });

    expect(socketManager.emitToDrivers).toHaveBeenCalledWith(
      'ride:new_request',
      expect.objectContaining({
        rideId: 'ride-1',
        pickup: { lat: 10, lng: 106 },
        destination: { lat: 10.5, lng: 106.5 },
        estimatedFare: 50000,
      })
    );
  });

  it('handleDriverLocationUpdated: emits to ride room when rideId present', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleDriverLocationUpdated({
      rideId: 'ride-1',
      driverId: 'drv-1',
      lat: 10,
      lng: 106,
      heading: 180,
    });

    expect(socketManager.emitToRide).toHaveBeenCalledWith(
      'ride-1',
      'driver:location',
      expect.objectContaining({
        driverId: 'drv-1',
        lat: 10,
        lng: 106,
        heading: 180,
      })
    );
  });

  it('handleDriverLocationUpdated: does nothing when rideId missing', () => {
    const { EventConsumer } = require('../../events/consumer');

    const socketManager = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      emitToRole: jest.fn(),
    };

    const consumer = new EventConsumer(socketManager as any);

    (consumer as any).handleDriverLocationUpdated({
      driverId: 'drv-1',
      lat: 10,
      lng: 106,
      heading: 180,
    });

    expect(socketManager.emitToRide).not.toHaveBeenCalled();
  });
});
