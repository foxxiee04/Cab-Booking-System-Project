import Redis from 'ioredis';
import { PrismaClient, DriverStatus, AvailabilityStatus, VehicleType } from '@prisma/client';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
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

  async registerDriver(input: RegisterDriverInput): Promise<any> {
    // Check if driver already exists
    const existing = await prisma.driver.findUnique({
      where: { userId: input.userId },
    });
    
    if (existing) {
      throw new Error('Driver already registered');
    }

    const driver = await prisma.driver.create({
      data: {
        userId: input.userId,
        status: DriverStatus.PENDING,
        availabilityStatus: AvailabilityStatus.OFFLINE,
        vehicleType: input.vehicle.type as VehicleType,
        vehicleBrand: input.vehicle.brand,
        vehicleModel: input.vehicle.model,
        vehiclePlate: input.vehicle.plate,
        vehicleColor: input.vehicle.color,
        vehicleYear: input.vehicle.year,
        licenseNumber: input.license.number,
        licenseExpiryDate: input.license.expiryDate,
        licenseVerified: false,
      },
    });

    return driver;
  }

  async getDriverByUserId(userId: string): Promise<any | null> {
    return prisma.driver.findUnique({
      where: { userId },
    });
  }

  async getDriverById(driverId: string): Promise<any | null> {
    return prisma.driver.findUnique({
      where: { id: driverId },
    });
  }

  async goOnline(userId: string): Promise<any> {
    // Get existing driver
    const driver = await prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new Error('Driver profile not found. Please complete profile setup first.');
    }

    // Check if driver is approved
    if (driver.status !== DriverStatus.APPROVED) {
      throw new Error(`Driver must be approved before going online. Current status: ${driver.status}`);
    }

    // Update to online
    const updatedDriver = await prisma.driver.update({
      where: { userId },
      data: { availabilityStatus: AvailabilityStatus.ONLINE },
    });

    return updatedDriver;
  }

  async goOffline(userId: string): Promise<any> {
    const driver = await prisma.driver.update({
      where: { userId },
      data: { 
        availabilityStatus: AvailabilityStatus.OFFLINE,
        currentRideId: null,
      },
    });

    // Remove from geo-index
    await this.redis.zrem(GEO_KEY, driver.id);

    return driver;
  }

  async updateLocation(driverId: string, location: GeoPoint): Promise<void> {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver || driver.availabilityStatus !== AvailabilityStatus.ONLINE) {
      throw new Error('Driver is not online');
    }

    // Update location in PostgreSQL
    await prisma.driver.update({
      where: { id: driverId },
      data: {
        lastLocationLat: location.lat,
        lastLocationLng: location.lng,
        lastLocationTime: new Date(),
      },
    });

    // Also store in Redis for real-time queries
    await this.redis.geoadd(GEO_KEY, location.lng, location.lat, driverId);
    await this.redis.setex(
      `driver:location:${driverId}`,
      300, // 5 minutes
      JSON.stringify({ lat: location.lat, lng: location.lng, timestamp: Date.now() })
    );
  }

  async getNearbyDrivers(location: GeoPoint, radiusKm = 5): Promise<NearbyDriver[]> {
    const results = await this.redis.georadius(
      GEO_KEY,
      location.lng,
      location.lat,
      radiusKm,
      'km',
      'WITHDIST',
      'ASC'
    );

    return results.map((r: any) => ({
      driverId: r[0] as string,
      distance: parseFloat(r[1] as string),
    }));
  }

  async setBusy(driverId: string, rideId: string): Promise<any> {
    return prisma.driver.update({
      where: { id: driverId },
      data: {
        availabilityStatus: AvailabilityStatus.BUSY,
        currentRideId: rideId,
      },
    });
  }

  async setAvailable(driverId: string): Promise<any> {
    return prisma.driver.update({
      where: { id: driverId },
      data: {
        availabilityStatus: AvailabilityStatus.ONLINE,
        currentRideId: null,
      },
    });
  }

  async approveDriver(driverId: string): Promise<any> {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.APPROVED },
    });

    await this.eventPublisher.publish('driver.approved', {
      driverId: driver.id,
      userId: driver.userId,
    });

    return driver;
  }

  async rejectDriver(driverId: string, reason?: string): Promise<any> {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.REJECTED },
    });

    await this.eventPublisher.publish('driver.rejected', {
      driverId: driver.id,
      userId: driver.userId,
      reason,
    });

    return driver;
  }

  async updateRating(driverId: string, newRating: number): Promise<void> {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new Error('Driver not found');
    }

    const totalRating = driver.ratingAverage * driver.ratingCount + newRating;
    const newCount = driver.ratingCount + 1;
    const newAverage = totalRating / newCount;

    await prisma.driver.update({
      where: { id: driverId },
      data: {
        ratingAverage: newAverage,
        ratingCount: newCount,
      },
    });
  }

  async updateDriver(driverId: string, data: any): Promise<any> {
    return prisma.driver.update({
      where: { id: driverId },
      data,
    });
  }

  async getDrivers(filters?: {
    status?: DriverStatus;
    availabilityStatus?: AvailabilityStatus;
  }): Promise<any[]> {
    return prisma.driver.findMany({
      where: {
        status: filters?.status,
        availabilityStatus: filters?.availabilityStatus,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export { prisma };
