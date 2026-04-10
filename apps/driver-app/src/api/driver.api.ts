import axiosInstance from './axios.config';
import { ApiResponse, Driver, DriverRegistration, Location, Earnings, NearbyDriver } from '../types';

interface NearbyDriversApiResponse {
  success: boolean;
  data: { drivers: NearbyDriver[] };
}

const DRIVER_COMMISSION_RATE = 0.2;
const EARNINGS_DAYS = 7;

const normalizeDistance = (distance: unknown): number | undefined => {
  if (typeof distance !== 'number' || Number.isNaN(distance) || distance <= 0) {
    return undefined;
  }

  return distance > 100 ? distance : distance * 1000;
};

const normalizeDuration = (duration: unknown, estimatedDuration: unknown): number | undefined => {
  const raw = typeof duration === 'number' && duration > 0
    ? duration
    : typeof estimatedDuration === 'number' && estimatedDuration > 0
      ? estimatedDuration
      : undefined;

  if (raw == null) {
    return undefined;
  }

  // Some endpoints still return minutes while others return seconds.
  return raw <= 180 ? raw * 60 : raw;
};

const normalizeLocation = (rawLocation: any, fallbackLat: any, fallbackLng: any, fallbackAddress?: string) => {
  const lat = rawLocation?.lat ?? rawLocation?.latitude ?? fallbackLat;
  const lng = rawLocation?.lng ?? rawLocation?.longitude ?? fallbackLng;

  return {
    lat: typeof lat === 'number' ? lat : 0,
    lng: typeof lng === 'number' ? lng : 0,
    address: rawLocation?.address || fallbackAddress || '',
  };
};

const normalizeRideHistoryItem = (ride: any) => ({
  ...ride,
  pickupLocation: normalizeLocation(ride.pickupLocation || ride.pickup, ride.pickupLat, ride.pickupLng, ride.pickupAddress),
  dropoffLocation: normalizeLocation(ride.dropoffLocation || ride.dropoff, ride.dropoffLat, ride.dropoffLng, ride.dropoffAddress),
  distance: normalizeDistance(ride.distance),
  duration: normalizeDuration(ride.duration, ride.estimatedDuration),
  estimatedDuration: normalizeDuration(ride.estimatedDuration, ride.duration),
});

const normalizeDriver = (driver: any): Driver => {
  const reviewCount = driver.reviewCount ?? driver.ratingCount ?? 0;

  return {
    id: driver.id,
    userId: driver.userId,
    vehicleType: driver.vehicleType,
    vehicleMake: driver.vehicleMake || driver.vehicleBrand || '',
    vehicleModel: driver.vehicleModel || '',
    vehicleColor: driver.vehicleColor || '',
    vehicleYear: driver.vehicleYear || undefined,
    vehicleImageUrl: driver.vehicleImageUrl || undefined,
    licensePlate: driver.licensePlate || driver.vehiclePlate || '',
    licenseClass: driver.licenseClass || undefined,
    licenseNumber: driver.licenseNumber || '',
    licenseExpiryDate: driver.licenseExpiryDate || undefined,
    status: driver.status,
    rating: reviewCount > 0 ? (driver.rating ?? driver.ratingAverage ?? 0) : 0,
    reviewCount,
    totalRides: driver.totalRides ?? driver.ratingCount ?? 0,
    isOnline: driver.isOnline ?? ['ONLINE', 'BUSY'].includes(driver.availabilityStatus),
    isAvailable: driver.isAvailable ?? driver.availabilityStatus === 'ONLINE',
    currentLocation:
      driver.currentLocation || (driver.lastLocationLat != null && driver.lastLocationLng != null
        ? {
            lat: driver.lastLocationLat,
            lng: driver.lastLocationLng,
          }
        : null),
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
};

const mapVehicleType = (type: DriverRegistration['vehicleType']): DriverRegistration['vehicleType'] => type;

export const driverApi = {
  // Register as driver (complete profile)
  registerDriver: async (data: DriverRegistration): Promise<ApiResponse<{ driver: Driver }>> => {
    const payload = {
      vehicle: {
        type: mapVehicleType(data.vehicleType),
        brand: data.vehicleMake,
        model: data.vehicleModel,
        color: data.vehicleColor,
        plate: data.licensePlate,
        year: data.vehicleYear || new Date().getFullYear(),
        imageUrl: data.vehicleImageUrl,
      },
      license: {
        class: data.licenseClass,
        number: data.licenseNumber,
        expiryDate: data.licenseExpiryDate,
      },
    };
    const response = await axiosInstance.post('/drivers/register', payload);
    return response.data;
  },

  // Get driver profile
  getProfile: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.get('/drivers/me');
    const payload = response.data?.data || response.data;
    return {
      ...response.data,
      data: {
        driver: normalizeDriver(payload.driver || payload),
      },
    };
  },

  // Update driver profile
  updateProfile: async (data: Partial<Driver>): Promise<ApiResponse<{ driver: Driver }>> => {
    const requestPayload = {
      vehicleType: data.vehicleType,
      vehicleMake: data.vehicleMake,
      vehicleModel: data.vehicleModel,
      vehicleColor: data.vehicleColor,
      vehicleYear: data.vehicleYear,
      vehicleImageUrl: data.vehicleImageUrl,
      licensePlate: data.licensePlate,
      licenseClass: data.licenseClass,
      licenseNumber: data.licenseNumber,
      licenseExpiryDate: data.licenseExpiryDate,
    };

    const response = await axiosInstance.put('/drivers/me', requestPayload);
    const responsePayload = response.data?.data || response.data;
    return {
      ...response.data,
      data: {
        driver: normalizeDriver(responsePayload.driver || responsePayload),
      },
    };
  },

  // Go online
  goOnline: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/me/online');
    const payload = response.data?.data || response.data;
    return {
      ...response.data,
      data: {
        driver: normalizeDriver(payload.driver || payload),
      },
    };
  },

  // Go offline
  goOffline: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/me/offline');
    const payload = response.data?.data || response.data;
    return {
      ...response.data,
      data: {
        driver: normalizeDriver(payload.driver || payload),
      },
    };
  },

  // Get nearby online drivers
  getNearbyDrivers: async (params: { lat: number; lng: number; radius?: number }): Promise<NearbyDriversApiResponse> => {
    const response = await axiosInstance.get('/drivers/nearby', { params });
    const payload = response.data?.data || response.data;
    const drivers = (payload?.drivers || [])
      .filter((d: any) => d?.id && d?.lat != null && d?.lng != null)
      .map((d: any) => ({
        id: d.id,
        lat: Number(d.lat),
        lng: Number(d.lng),
        vehicleType: d.vehicleType,
        heading: d.heading,
      }));
    return { ...response.data, data: { drivers } };
  },

  // Update location
  updateLocation: async (location: Location): Promise<ApiResponse> => {
    const response = await axiosInstance.post('/drivers/me/location', {
      lat: location.lat,
      lng: location.lng,
    });
    return response.data;
  },

  // Get earnings - Using alternative endpoint since /drivers/me/earnings doesn't exist
  getEarnings: async (): Promise<ApiResponse<{ earnings: Earnings }>> => {
    try {
      const ridesResponse = await axiosInstance.get('/rides/driver/history', { 
        params: { status: 'COMPLETED', limit: 1000 } 
      });
      
      const completedRides = [...(ridesResponse.data.data?.rides || [])].sort((left: any, right: any) => {
        const leftTime = new Date(left.completedAt || left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.completedAt || right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      });

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const toNet = (amount: number) => Math.round(amount * (1 - DRIVER_COMMISSION_RATE));
      const toCommission = (amount: number) => Math.round(amount * DRIVER_COMMISSION_RATE);

      const grossTotal = completedRides.reduce((sum: number, ride: any) => sum + (ride.fare || 0), 0);
      const commissionTotal = completedRides.reduce((sum: number, ride: any) => sum + toCommission(ride.fare || 0), 0);
      const netTotal = grossTotal - commissionTotal;

      const filterByDate = (boundary: Date) => completedRides.filter((ride: any) => new Date(ride.completedAt || ride.updatedAt || ride.createdAt) >= boundary);
      const todayRides = filterByDate(startOfToday);
      const weekRides = filterByDate(startOfWeek);
      const monthRides = filterByDate(startOfMonth);

      const buildDayLabel = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

      const daily = Array.from({ length: EARNINGS_DAYS }, (_, index) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + index);

        const dayRides = completedRides.filter((ride: any) => {
          const rideDate = new Date(ride.completedAt || ride.updatedAt || ride.createdAt);
          return rideDate.toDateString() === date.toDateString();
        });

        const gross = dayRides.reduce((sum: number, ride: any) => sum + (ride.fare || 0), 0);
        const commission = dayRides.reduce((sum: number, ride: any) => sum + toCommission(ride.fare || 0), 0);

        return {
          label: buildDayLabel(date),
          gross,
          commission,
          net: gross - commission,
          rides: dayRides.length,
        };
      });

      const recentTrips = completedRides.slice(0, 8).map((ride: any) => {
        const gross = ride.fare || 0;
        const commission = toCommission(gross);

        return {
          rideId: ride.id,
          completedAt: ride.completedAt || ride.updatedAt || ride.createdAt,
          pickupAddress: ride.pickupLocation?.address || ride.pickupAddress || 'Điểm đón',
          dropoffAddress: ride.dropoffLocation?.address || ride.dropoffAddress || 'Điểm đến',
          gross,
          commission,
          net: gross - commission,
          paymentMethod: ride.paymentMethod,
          vehicleType: ride.vehicleType,
        };
      });
      
      return {
        success: true,
        data: {
          earnings: {
            today: todayRides.reduce((sum: number, ride: any) => sum + toNet(ride.fare || 0), 0),
            week: weekRides.reduce((sum: number, ride: any) => sum + toNet(ride.fare || 0), 0),
            month: monthRides.reduce((sum: number, ride: any) => sum + toNet(ride.fare || 0), 0),
            totalRides: completedRides.length,
            grossTotal,
            commissionTotal,
            netTotal,
            commissionRate: DRIVER_COMMISSION_RATE,
            daily,
            recentTrips,
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        data: {
          earnings: {
            today: 0,
            week: 0,
            month: 0,
            totalRides: 0,
            grossTotal: 0,
            commissionTotal: 0,
            netTotal: 0,
            commissionRate: DRIVER_COMMISSION_RATE,
            daily: [],
            recentTrips: [],
          }
        }
      };
    }
  },

  // Get ride history - Using /rides/driver/history endpoint
  getRideHistory: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ rides: any[]; total: number }>> => {
    // Use driver-specific ride history endpoint
    const response = await axiosInstance.get('/rides/driver/history', { 
      params: {
        ...params,
        // Include all relevant statuses for driver history
        status: ['COMPLETED', 'CANCELLED'].join(',')
      } 
    });
    
    const ridesData = response.data.data || response.data;
    return {
      ...response.data,
      data: {
        rides: (ridesData.rides || []).map(normalizeRideHistoryItem),
        total: ridesData.total || 0,
      }
    };
  },
};
