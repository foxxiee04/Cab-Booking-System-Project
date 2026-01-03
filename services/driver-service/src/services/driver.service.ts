import Redis from 'ioredis';
import { Driver, IDriver, DriverStatus } from '../models/driver.model';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

const GEO_KEY = 'drivers:geo:online';

interface RegisterDriverInput {
  userId: string;
  vehicle: {
    type: 'CAR' | 'MOTORCYCLE' | 'SUV';
    brand: string;
    model: string;
    plate: string;
    color: string;
    year: number;
  };
  license: {
    number: string;
    expiryDate: Date;
  };
}

interface GeoPoint {
  lat: number;
  lng: number;
}

interface NearbyDriver {
  driverId: string;
  distance: number; // km
}

export class DriverService {
  private redis: Redis;
  private eventPublisher: EventPublisher;

  constructor(redis: Redis, eventPublisher: EventPublisher) {
    this.redis = redis;
    this.eventPublisher = eventPublisher;
  }

  async registerDriver(input: RegisterDriverInput): Promise<IDriver> {
    // Check if driver already exists
    const existing = await Driver.findOne({ userId: input.userId });
    if (existing) {
      throw new Error('Driver already registered');
    }

    const driver = new Driver({
      userId: input.userId,
      status: DriverStatus.OFFLINE,
      vehicle: input.vehicle,
      license: {
        ...input.license,
        verified: false,
      },
    });

    await driver.save();
    return driver;
  }

  async getDriverByUserId(userId: string): Promise<IDriver | null> {
    return Driver.findOne({ userId });
  }

  async getDriverById(driverId: string): Promise<IDriver | null> {
    return Driver.findById(driverId);
  }

  async goOnline(userId: string): Promise<IDriver> {
    const driver = await Driver.findOneAndUpdate(
      { userId, status: { $in: [DriverStatus.OFFLINE] } },
      { status: DriverStatus.ONLINE },
      { new: true }
    );

    if (!driver) {
      throw new Error('Driver not found or cannot go online');
    }

    await this.eventPublisher.publish('driver.online', {
      driverId: driver._id.toString(),
      userId: driver.userId,
    });

    return driver;
  }

  async goOffline(userId: string): Promise<IDriver> {
    const driver = await Driver.findOneAndUpdate(
      { userId, status: { $in: [DriverStatus.ONLINE, DriverStatus.BUSY] } },
      { status: DriverStatus.OFFLINE, currentRideId: null },
      { new: true }
    );

    if (!driver) {
      throw new Error('Driver not found or already offline');
    }

    // Remove from geo set
    await this.redis.zrem(GEO_KEY, driver._id.toString());

    await this.eventPublisher.publish('driver.offline', {
      driverId: driver._id.toString(),
      userId: driver.userId,
    });

    return driver;
  }

  async updateLocation(userId: string, location: GeoPoint): Promise<void> {
    const driver = await Driver.findOne({ userId });
    if (!driver) {
      throw new Error('Driver not found');
    }

    if (driver.status === DriverStatus.OFFLINE || driver.status === DriverStatus.SUSPENDED) {
      throw new Error('Driver is not online');
    }

    // Update in MongoDB
    driver.lastLocation = {
      lat: location.lat,
      lng: location.lng,
      updatedAt: new Date(),
    };
    await driver.save();

    // Update in Redis Geo (only if online/available)
    if (driver.status === DriverStatus.ONLINE) {
      await this.redis.geoadd(GEO_KEY, location.lng, location.lat, driver._id.toString());
      // Set TTL for the driver key
      await this.redis.set(`driver:${driver._id}:lastSeen`, Date.now().toString(), 'EX', config.driver.locationTTL);
    }

    // Publish event
    await this.eventPublisher.publish('driver.location.updated', {
      driverId: driver._id.toString(),
      userId: driver.userId,
      location,
      timestamp: new Date().toISOString(),
      currentRideId: driver.currentRideId,
    });
  }

  async findNearbyDrivers(location: GeoPoint, radiusKm: number = 5, limit: number = 10): Promise<NearbyDriver[]> {
    // GEORADIUS returns [member, distance] pairs
    const results = await this.redis.georadius(
      GEO_KEY,
      location.lng,
      location.lat,
      radiusKm,
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      limit
    );

    const nearbyDrivers: NearbyDriver[] = [];

    for (const result of results as [string, string][]) {
      const [driverId, distanceStr] = result;
      
      // Check if driver is still available
      const driver = await Driver.findById(driverId);
      if (driver && driver.status === DriverStatus.ONLINE) {
        nearbyDrivers.push({
          driverId,
          distance: parseFloat(distanceStr),
        });
      }
    }

    return nearbyDrivers;
  }

  async markBusy(userId: string, rideId: string): Promise<IDriver> {
    const driver = await Driver.findOneAndUpdate(
      { userId, status: DriverStatus.ONLINE },
      { status: DriverStatus.BUSY, currentRideId: rideId },
      { new: true }
    );

    if (!driver) {
      throw new Error('Driver not found or not online');
    }

    // Remove from available geo set
    await this.redis.zrem(GEO_KEY, driver._id.toString());

    await this.eventPublisher.publish('driver.became_busy', {
      driverId: driver._id.toString(),
      userId: driver.userId,
      rideId,
    });

    return driver;
  }

  async markAvailable(userId: string): Promise<IDriver> {
    const driver = await Driver.findOneAndUpdate(
      { userId, status: DriverStatus.BUSY },
      { status: DriverStatus.ONLINE, currentRideId: null },
      { new: true }
    );

    if (!driver) {
      throw new Error('Driver not found or not busy');
    }

    // Add back to geo set if has location
    if (driver.lastLocation) {
      await this.redis.geoadd(GEO_KEY, driver.lastLocation.lng, driver.lastLocation.lat, driver._id.toString());
    }

    await this.eventPublisher.publish('driver.became_available', {
      driverId: driver._id.toString(),
      userId: driver.userId,
    });

    return driver;
  }

  async getDrivers(page = 1, limit = 20, status?: DriverStatus): Promise<{ drivers: IDriver[]; total: number }> {
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;
    
    const [drivers, total] = await Promise.all([
      Driver.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Driver.countDocuments(query),
    ]);

    return { drivers, total };
  }

  async updateDriverVerification(driverId: string, verified: boolean): Promise<IDriver | null> {
    return Driver.findByIdAndUpdate(
      driverId,
      { 'license.verified': verified },
      { new: true }
    );
  }
}
