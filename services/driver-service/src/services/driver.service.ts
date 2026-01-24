import Redis from 'ioredis';
import { Driver, IDriver, DriverStatus, AvailabilityStatus } from '../models/driver.model';
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
      status: DriverStatus.PENDING,
      availabilityStatus: AvailabilityStatus.OFFLINE,
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
    // First, try to find and update existing driver
    let driver = await Driver.findOneAndUpdate(
      { userId, availabilityStatus: { $in: [AvailabilityStatus.OFFLINE] } },
      { availabilityStatus: AvailabilityStatus.ONLINE },
      { new: true }
    );

    // If driver profile doesn't exist, create a default one
    if (!driver) {
      const existingDriver = await Driver.findOne({ userId });
      if (!existingDriver) {
        logger.info(`Auto-creating driver profile for userId: ${userId}`);
        driver = new Driver({
          userId,
          status: DriverStatus.PENDING,
          availabilityStatus: AvailabilityStatus.ONLINE,
          vehicle: {
            type: 'CAR',
            brand: 'Unknown',
            model: 'Unknown',
            plate: 'TEMP',
            color: 'Unknown',
            year: new Date().getFullYear(),
          },
          license: {
            number: 'TEMP',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            verified: false,
          },
        });
        await driver.save();
      } else {
        throw new Error('Driver found but cannot go online (check status)');
      }
    }

    await this.eventPublisher.publish('driver.online', {
      driverId: driver._id.toString(),
      userId: driver.userId,
    });

    return driver;
  }

  async goOffline(userId: string): Promise<IDriver> {
    const driver = await Driver.findOneAndUpdate(
      { userId, availabilityStatus: { $in: [AvailabilityStatus.ONLINE, AvailabilityStatus.BUSY] } },
      { availabilityStatus: AvailabilityStatus.OFFLINE, currentRideId: null },
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

    if (
      driver.availabilityStatus === AvailabilityStatus.OFFLINE ||
      driver.status === DriverStatus.SUSPENDED
    ) {
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
    if (driver.availabilityStatus === AvailabilityStatus.ONLINE) {
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
      if (driver && driver.availabilityStatus === AvailabilityStatus.ONLINE) {
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
      { userId, availabilityStatus: AvailabilityStatus.ONLINE },
      { availabilityStatus: AvailabilityStatus.BUSY, currentRideId: rideId },
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
      { userId, availabilityStatus: AvailabilityStatus.BUSY },
      { availabilityStatus: AvailabilityStatus.ONLINE, currentRideId: null },
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

  /**
   * Cleanup stale driver locations from Redis
   * Should be called periodically (e.g., every minute)
   */
  async cleanupStaleLocations(): Promise<void> {
    try {
      const geoMembers = await this.redis.zrange(GEO_KEY, 0, -1);
      const locationTTL = config.driver.locationTTL || 3600; // default 1 hour
      const now = Date.now();
      let cleaned = 0;

      for (const driverId of geoMembers) {
        const lastSeenStr = await this.redis.get(`driver:${driverId}:lastSeen`);
        
        if (!lastSeenStr) {
          // No last seen timestamp, remove from geo
          await this.redis.zrem(GEO_KEY, driverId);
          cleaned++;
          continue;
        }

        const lastSeen = parseInt(lastSeenStr);
        const ageSeconds = (now - lastSeen) / 1000;

        if (ageSeconds > locationTTL) {
          // Location is stale, remove from geo
          await this.redis.zrem(GEO_KEY, driverId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} stale driver locations`);
      }
    } catch (error) {
      logger.error('Error cleaning up stale locations:', error);
    }
  }
}
