import Redis from 'ioredis';
import axios from 'axios';
import { DriverStatus, AvailabilityStatus, VehicleType, LicenseClass } from '../generated/prisma-client';
import { config } from '../config';
import { prisma } from '../config/db';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';
import { isLicenseClassCompatible, normalizeLicenseClass, LicenseClass2026 } from '../utils/license-class';
const GEO_KEY = 'drivers:geo:online';

interface RegisterDriverInput {
  userId: string;
  vehicle: {
    type: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
    brand: string;
    model: string;
    plate: string;
    color: string;
    year: number;
    imageUrl?: string;
  };
  license: {
    class: LicenseClass2026;
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

interface DriverUserProfile {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  avatar?: string | null;
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

    const normalizedLicenseClass = normalizeLicenseClass(input.license.class);
    if (!normalizedLicenseClass) {
      throw new Error('License class is invalid');
    }

    if (!isLicenseClassCompatible(input.vehicle.type, normalizedLicenseClass)) {
      throw new Error('Hạng GPLX không phù hợp với loại xe đăng ký');
    }

    const driver = await prisma.driver.create({
      data: {
        userId: input.userId,
        status: DriverStatus.APPROVED,
        availabilityStatus: AvailabilityStatus.OFFLINE,
        vehicleType: input.vehicle.type as VehicleType,
        vehicleBrand: input.vehicle.brand,
        vehicleModel: input.vehicle.model,
        vehiclePlate: input.vehicle.plate,
        vehicleColor: input.vehicle.color,
        vehicleYear: input.vehicle.year,
        vehicleImageUrl: input.vehicle.imageUrl,
        licenseClass: normalizedLicenseClass as LicenseClass,
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

  private async fetchUserProfileFromUserService(userId: string): Promise<DriverUserProfile | null> {
    try {
      const response = await axios.get(`${config.services.user}/api/users/${userId}`, {
        timeout: 3000,
        headers: {
          'x-internal-token': config.internalServiceToken,
        },
      });

      return response.data?.data?.user ?? null;
    } catch (error) {
      logger.warn(`Failed to hydrate driver user profile from user-service for ${userId}:`, error);
      return null;
    }
  }

  private async fetchUserProfileFromAuthService(userId: string): Promise<DriverUserProfile | null> {
    try {
      const response = await axios.get(`${config.services.auth}/internal/users/${userId}`, {
        timeout: 3000,
        headers: {
          'x-internal-token': config.internalServiceToken,
        },
      });

      return response.data?.data?.user ?? null;
    } catch (error) {
      logger.warn(`Failed to hydrate driver user profile from auth-service for ${userId}:`, error);
      return null;
    }
  }

  private async getUserProfile(userId: string): Promise<DriverUserProfile | null> {
    const userProfile = await this.fetchUserProfileFromUserService(userId);
    if (userProfile) {
      return userProfile;
    }

    return this.fetchUserProfileFromAuthService(userId);
  }

  private normalizeIds(ids: Array<string | null | undefined>): string[] {
    return [...new Set(
      ids
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id))
    )];
  }

  private async getDriverCompletedRideCounts(driverIds: string[]): Promise<Record<string, number>> {
    const normalizedDriverIds = this.normalizeIds(driverIds);

    if (normalizedDriverIds.length === 0) {
      return {};
    }

    try {
      const response = await axios.get(`${config.services.ride}/internal/drivers/stats`, {
        timeout: 3000,
        headers: {
          'x-internal-token': config.internalServiceToken,
        },
        params: {
          ids: normalizedDriverIds.join(','),
        },
      });

      return response.data?.data?.counts ?? {};
    } catch (error) {
      logger.warn(`Failed to hydrate completed ride counts for drivers ${normalizedDriverIds.join(', ')}:`, error);
      return {};
    }
  }

  private async getDriverCompletedRideCount(driverId: string, fallbackDriverIds: Array<string | null | undefined> = []): Promise<number> {
    const actorIds = this.normalizeIds([driverId, ...fallbackDriverIds]);
    const rideCounts = await this.getDriverCompletedRideCounts(actorIds);

    return actorIds.reduce((total, actorId) => total + (rideCounts[actorId] ?? 0), 0);
  }

  private getDriverTotalRides(driver: { id: string; userId?: string | null }, rideCounts: Record<string, number>): number {
    return (rideCounts[driver.id] ?? 0) + (driver.userId ? rideCounts[driver.userId] ?? 0 : 0);
  }

  async getEnrichedDriverById(driverId: string): Promise<any | null> {
    const driver = await this.getDriverById(driverId);
    if (!driver) {
      return null;
    }

    const userProfile = driver.userId ? await this.getUserProfile(driver.userId) : null;

    return {
      ...driver,
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      phone: userProfile?.phone || userProfile?.phoneNumber || '',
      phoneNumber: userProfile?.phoneNumber || userProfile?.phone || '',
      avatar: userProfile?.avatar || null,
      currentLocation:
        driver.lastLocationLat != null && driver.lastLocationLng != null
          ? {
              lat: driver.lastLocationLat,
              lng: driver.lastLocationLng,
            }
          : null,
    };
  }

  async getPublicDriverProfile(driverId: string): Promise<any | null> {
    const driver = await this.getEnrichedDriverById(driverId);
    if (!driver) {
      return null;
    }

    const totalCompletedRides = await this.getDriverCompletedRideCount(driver.id, [driver.userId]);

    return {
      id: driver.id,
      userId: driver.userId,
      firstName: driver.firstName || '',
      lastName: driver.lastName || '',
      phoneNumber: driver.phoneNumber || driver.phone || '',
      avatar: driver.avatar || null,
      vehicleType: driver.vehicleType,
      vehicleMake: driver.vehicleBrand || '',
      vehicleModel: driver.vehicleModel || '',
      vehicleColor: driver.vehicleColor || '',
      vehicleYear: driver.vehicleYear || undefined,
      vehicleImageUrl: driver.vehicleImageUrl || undefined,
      licensePlate: driver.vehiclePlate || '',
      rating: driver.ratingAverage ?? 5,
      reviewCount: driver.ratingCount ?? 0,
      totalRides: totalCompletedRides,
      currentLocation: driver.currentLocation,
    };
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
    if (driver.status === DriverStatus.REJECTED || driver.status === DriverStatus.SUSPENDED) {
      throw new Error(`Driver account is not allowed to go online. Current status: ${driver.status}`);
    }

    // Check wallet status via wallet-service (keyed by userId, the authoritative wallet)
    const walletResponse = await axios.get(`${config.services.wallet}/internal/driver/${userId}/can-accept`, {
      timeout: 5000,
      headers: {
        'x-internal-token': config.internalServiceToken,
      },
    });

    const walletStatus = walletResponse.data?.data || {};

    if (walletStatus.canAcceptRide === false) {
      throw new Error(walletStatus.reason || 'Ví tài xế hiện không đủ điều kiện để nhận cuốc. Vui lòng nạp thêm tiền.');
    }

    // Update to online
    const updatedDriver = await prisma.driver.update({
      where: { userId },
      data: { availabilityStatus: AvailabilityStatus.ONLINE },
    });

    // Register in geo-index using last known location so driver is discoverable immediately
    if (updatedDriver.lastLocationLat != null && updatedDriver.lastLocationLng != null) {
      await this.redis.geoadd(GEO_KEY, updatedDriver.lastLocationLng, updatedDriver.lastLocationLat, updatedDriver.id);
    }

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

  async updateDriverProfile(driverId: string, data: any): Promise<any> {
    const currentDriver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!currentDriver) {
      throw new Error('Driver not found');
    }

    const nextVehicleType = String(data.vehicleType ?? currentDriver.vehicleType);
    const nextLicenseClass = normalizeLicenseClass(data.licenseClass ?? currentDriver.licenseClass);

    if (!nextLicenseClass) {
      throw new Error('License class is invalid');
    }

    if (!isLicenseClassCompatible(nextVehicleType, nextLicenseClass)) {
      throw new Error('Hạng GPLX không phù hợp với loại xe cập nhật');
    }

    const updateData: Record<string, any> = {};
    let shouldResetAvailability = false;

    if (data.vehicleType !== undefined) {
      updateData.vehicleType = data.vehicleType;
      shouldResetAvailability = true;
    }
    if (data.vehicleMake !== undefined) {
      updateData.vehicleBrand = data.vehicleMake;
      shouldResetAvailability = true;
    }
    if (data.vehicleModel !== undefined) {
      updateData.vehicleModel = data.vehicleModel;
      shouldResetAvailability = true;
    }
    if (data.vehicleColor !== undefined) {
      updateData.vehicleColor = data.vehicleColor;
      shouldResetAvailability = true;
    }
    if (data.vehicleYear !== undefined) {
      updateData.vehicleYear = data.vehicleYear;
      shouldResetAvailability = true;
    }
    if (data.licensePlate !== undefined) {
      updateData.vehiclePlate = data.licensePlate;
      shouldResetAvailability = true;
    }
    if (data.vehicleImageUrl !== undefined) {
      updateData.vehicleImageUrl = data.vehicleImageUrl;
      shouldResetAvailability = true;
    }
    if (data.licenseClass !== undefined) {
      const normalizedLicenseClass = normalizeLicenseClass(data.licenseClass);
      if (!normalizedLicenseClass) {
        throw new Error('License class is invalid');
      }
      updateData.licenseClass = normalizedLicenseClass;
      shouldResetAvailability = true;
    }
    if (data.licenseNumber !== undefined) {
      updateData.licenseNumber = data.licenseNumber;
      shouldResetAvailability = true;
    }
    if (data.licenseExpiryDate !== undefined) {
      updateData.licenseExpiryDate = new Date(data.licenseExpiryDate);
      shouldResetAvailability = true;
    }

    if (shouldResetAvailability) {
      updateData.availabilityStatus = AvailabilityStatus.OFFLINE;
      updateData.licenseVerified = false;
      updateData.currentRideId = null;
    }

    return prisma.driver.update({
      where: { id: driverId },
      data: updateData,
    });
  }

  async getDrivers(filters?: {
    status?: DriverStatus;
    availabilityStatus?: AvailabilityStatus;
  }): Promise<any[]> {
    const drivers = await prisma.driver.findMany({
      where: {
        status: filters?.status,
        availabilityStatus: filters?.availabilityStatus,
      },
      orderBy: { createdAt: 'desc' },
    });

    const rideActorIds = drivers.reduce<string[]>((ids, driver) => {
      ids.push(driver.id);
      if (driver.userId) {
        ids.push(driver.userId);
      }
      return ids;
    }, []);
    const rideCounts = await this.getDriverCompletedRideCounts(rideActorIds);

    return drivers.map((driver) => ({
      ...driver,
      totalRides: this.getDriverTotalRides(driver, rideCounts),
    }));
  }
}

export { prisma };
