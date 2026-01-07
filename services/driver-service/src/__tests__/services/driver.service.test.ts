jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../models/driver.model', () => {
  const Driver: any = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  return {
    DriverStatus: {
      OFFLINE: 'OFFLINE',
      ONLINE: 'ONLINE',
      BUSY: 'BUSY',
      SUSPENDED: 'SUSPENDED',
    },
    Driver,
  };
});

describe('DriverService (Application/use-case)', () => {
  let DriverService: any;
  let redis: any;
  let eventPublisher: { publish: jest.Mock };
  let service: any;

  beforeEach(() => {
    ({ DriverService } = require('../../services/driver.service'));
    const { Driver } = require('../../models/driver.model');

    redis = {
      zrem: jest.fn(async () => 1),
      geoadd: jest.fn(async () => 1),
      set: jest.fn(async () => 'OK'),
      georadius: jest.fn(async () => []),
    };

    eventPublisher = { publish: jest.fn() };
    service = new DriverService(redis as any, eventPublisher as any);

    jest.clearAllMocks();

    // Ensure model mocks are reset too
    Driver.findOne.mockReset();
    Driver.findOneAndUpdate.mockReset();
    Driver.findById.mockReset();
    Driver.findByIdAndUpdate.mockReset();
    Driver.find.mockReset();
    Driver.countDocuments.mockReset();
  });

  it('goOnline: updates driver status and publishes driver.online', async () => {
    const { Driver } = require('../../models/driver.model');
    Driver.findOneAndUpdate.mockResolvedValue({
      _id: { toString: () => 'drv-1' },
      userId: 'user-1',
      status: 'ONLINE',
    });

    const driver = await service.goOnline('user-1');

    expect(Driver.findOneAndUpdate).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith('driver.online', {
      driverId: 'drv-1',
      userId: 'user-1',
    });
    expect(driver.userId).toBe('user-1');
  });

  it('goOffline: removes from geo set and publishes driver.offline', async () => {
    const { Driver } = require('../../models/driver.model');
    Driver.findOneAndUpdate.mockResolvedValue({
      _id: { toString: () => 'drv-1' },
      userId: 'user-1',
      status: 'OFFLINE',
      currentRideId: null,
    });

    await service.goOffline('user-1');

    expect(redis.zrem).toHaveBeenCalledWith('drivers:geo:online', 'drv-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith('driver.offline', {
      driverId: 'drv-1',
      userId: 'user-1',
    });
  });

  it('updateLocation: ONLINE -> saves + geoadd + lastSeen ttl + publishes driver.location.updated', async () => {
    const { Driver } = require('../../models/driver.model');
    const driverDoc: any = {
      _id: { toString: () => 'drv-1' },
      userId: 'user-1',
      status: 'ONLINE',
      currentRideId: null,
      lastLocation: null,
      save: jest.fn(async () => driverDoc),
    };

    Driver.findOne.mockResolvedValue(driverDoc);

    await service.updateLocation('user-1', { lat: 10.1, lng: 106.2 });

    expect(driverDoc.save).toHaveBeenCalledTimes(1);
    expect(redis.geoadd).toHaveBeenCalledWith('drivers:geo:online', 106.2, 10.1, 'drv-1');
    expect(redis.set).toHaveBeenCalledWith(
      'driver:drv-1:lastSeen',
      expect.any(String),
      'EX',
      expect.any(Number)
    );

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'driver.location.updated',
      expect.objectContaining({
        driverId: 'drv-1',
        userId: 'user-1',
        location: { lat: 10.1, lng: 106.2 },
      })
    );
  });

  it('updateLocation: BUSY -> saves but does not geoadd', async () => {
    const { Driver } = require('../../models/driver.model');
    const driverDoc: any = {
      _id: { toString: () => 'drv-1' },
      userId: 'user-1',
      status: 'BUSY',
      currentRideId: 'ride-1',
      save: jest.fn(async () => driverDoc),
    };

    Driver.findOne.mockResolvedValue(driverDoc);

    await service.updateLocation('user-1', { lat: 10.1, lng: 106.2 });

    expect(driverDoc.save).toHaveBeenCalledTimes(1);
    expect(redis.geoadd).not.toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'driver.location.updated',
      expect.objectContaining({ currentRideId: 'ride-1' })
    );
  });

  it('findNearbyDrivers: filters only ONLINE drivers', async () => {
    const { Driver } = require('../../models/driver.model');
    redis.georadius.mockResolvedValue([
      ['drv-1', '0.5'],
      ['drv-2', '0.7'],
    ]);

    Driver.findById
      .mockResolvedValueOnce({ _id: 'drv-1', status: 'ONLINE' })
      .mockResolvedValueOnce({ _id: 'drv-2', status: 'BUSY' });

    const res = await service.findNearbyDrivers({ lat: 10, lng: 106 }, 5, 10);

    expect(redis.georadius).toHaveBeenCalled();
    expect(res).toEqual([{ driverId: 'drv-1', distance: 0.5 }]);
  });

  it('markBusy: removes from geo set and publishes driver.became_busy', async () => {
    const { Driver } = require('../../models/driver.model');
    Driver.findOneAndUpdate.mockResolvedValue({
      _id: { toString: () => 'drv-1' },
      userId: 'user-1',
      status: 'BUSY',
      currentRideId: 'ride-1',
    });

    await service.markBusy('user-1', 'ride-1');

    expect(redis.zrem).toHaveBeenCalledWith('drivers:geo:online', 'drv-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith('driver.became_busy', {
      driverId: 'drv-1',
      userId: 'user-1',
      rideId: 'ride-1',
    });
  });

  it('markAvailable: adds back to geo set if lastLocation exists and publishes driver.became_available', async () => {
    const { Driver } = require('../../models/driver.model');
    Driver.findOneAndUpdate.mockResolvedValue({
      _id: { toString: () => 'drv-1' },
      userId: 'user-1',
      status: 'ONLINE',
      currentRideId: null,
      lastLocation: { lat: 10.1, lng: 106.2, updatedAt: new Date() },
    });

    await service.markAvailable('user-1');

    expect(redis.geoadd).toHaveBeenCalledWith('drivers:geo:online', 106.2, 10.1, 'drv-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith('driver.became_available', {
      driverId: 'drv-1',
      userId: 'user-1',
    });
  });
});
