import axiosInstance from './axios.config';
import { Ride, Location, VehicleType, PaymentMethod } from '../types';

export interface CreateRideRequest {
  pickup: Location;
  dropoff: Location;
  vehicleType?: VehicleType;
  paymentMethod?: PaymentMethod;
  voucherCode?: string;
}

export interface RideResponse {
  success: boolean;
  data: {
    ride: Ride;
  };
}

export interface RidesResponse {
  success: boolean;
  data: {
    rides: Ride[];
    total: number;
    page: number;
    limit: number;
  };
}

const normalizeDistanceMeters = (distance: unknown, fallbackDistance?: unknown): number | null => {
  const raw = typeof distance === 'number' && Number.isFinite(distance)
    ? distance
    : typeof fallbackDistance === 'number' && Number.isFinite(fallbackDistance)
      ? fallbackDistance
      : null;

  if (raw == null || raw <= 0) {
    return null;
  }

  return raw > 100 ? raw : Math.round(raw * 1000);
};

const normalizeDurationSeconds = (duration: unknown, fallbackDuration?: unknown): number | null => {
  const raw = typeof duration === 'number' && Number.isFinite(duration)
    ? duration
    : typeof fallbackDuration === 'number' && Number.isFinite(fallbackDuration)
      ? fallbackDuration
      : null;

  if (raw == null || raw <= 0) {
    return null;
  }

  return raw <= 30 ? Math.round(raw * 60) : Math.round(raw);
};

const hasVisibleDriverIdentity = (driver: any): boolean => Boolean(
  driver && (
    `${driver.firstName || ''} ${driver.lastName || ''}`.trim()
    || driver.phoneNumber
    || driver.avatar
    || driver.licensePlate
  )
);

const shouldRevealDriverIdentity = (status: unknown): boolean => (
  ['ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED'].includes(String(status || ''))
);

const hydrateRideDriver = async (ride: Ride): Promise<Ride> => {
  if (!ride.driverId || !shouldRevealDriverIdentity(ride.status) || hasVisibleDriverIdentity(ride.driver)) {
    return ride;
  }

  try {
    const response = await axiosInstance.get(`/drivers/${ride.driverId}/profile`);
    const driver = response.data?.data?.driver;

    if (!driver) {
      return ride;
    }

    return {
      ...ride,
      driver,
    };
  } catch {
    return ride;
  }
};

const normalizeRide = (ride: any): Ride => {
  const rawPickup = ride.pickup || ride.pickupLocation;
  const pickup = rawPickup
    ? {
        lat: rawPickup.lat ?? rawPickup.latitude ?? ride.pickupLat ?? 0,
        lng: rawPickup.lng ?? rawPickup.longitude ?? ride.pickupLng ?? 0,
        address: rawPickup.address || ride.pickupAddress || '',
      }
    : ride.pickupLat != null
    ? { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress || '' }
    : { lat: 0, lng: 0, address: '' };

  const rawDropoff = ride.dropoff || ride.dropoffLocation;
  const dropoff = rawDropoff
    ? {
        lat: rawDropoff.lat ?? rawDropoff.latitude ?? ride.dropoffLat ?? 0,
        lng: rawDropoff.lng ?? rawDropoff.longitude ?? ride.dropoffLng ?? 0,
        address: rawDropoff.address || ride.dropoffAddress || '',
      }
    : ride.dropoffLat != null
    ? { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress || '' }
    : { lat: 0, lng: 0, address: '' };

  const normalizedDistance = normalizeDistanceMeters(ride.distance, ride.estimatedDistance);
  const normalizedDuration = normalizeDurationSeconds(ride.duration, ride.estimatedDuration);
  const normalizedEstimatedDistance = normalizeDistanceMeters(ride.estimatedDistance, ride.distance);
  const normalizedEstimatedDuration = normalizeDurationSeconds(ride.estimatedDuration, ride.duration);
  const normalizedFare = typeof ride.fare === 'number' && Number.isFinite(ride.fare) && ride.fare > 0
    ? ride.fare
    : typeof ride.estimatedFare === 'number' && Number.isFinite(ride.estimatedFare) && ride.estimatedFare > 0
      ? ride.estimatedFare
      : null;

  return {
    ...ride,
    pickup,
    dropoff,
    pickupLocation: pickup,
    dropoffLocation: dropoff,
    distance: normalizedDistance,
    duration: normalizedDuration,
    estimatedDistance: normalizedEstimatedDistance,
    estimatedDuration: normalizedEstimatedDuration,
    fare: normalizedFare,
    requestedAt: ride.requestedAt || ride.createdAt || ride.requested_at,
    assignedAt: ride.assignedAt ?? ride.assigned_at ?? null,
    acceptedAt: ride.acceptedAt ?? ride.accepted_at ?? null,
    startedAt: ride.startedAt ?? ride.started_at ?? null,
    completedAt: ride.completedAt ?? ride.completed_at ?? null,
    cancelledAt: ride.cancelledAt ?? ride.cancelled_at ?? null,
  } as Ride;
};

export const rideApi = {
  createRide: async (data: CreateRideRequest): Promise<RideResponse> => {
    const response = await axiosInstance.post('/rides', data);
    const payload = response.data?.data || response.data;
    const ride = await hydrateRideDriver(normalizeRide(payload.ride));
    return { ...response.data, data: { ride } };
  },

  getRide: async (rideId: string): Promise<RideResponse> => {
    const response = await axiosInstance.get(`/rides/${rideId}`);
    const payload = response.data?.data || response.data;
    const ride = await hydrateRideDriver(normalizeRide(payload.ride));
    return { ...response.data, data: { ride } };
  },

  getActiveRide: async (): Promise<RideResponse | null> => {
    try {
      const response = await axiosInstance.get('/rides/customer/active');
      const payload = response.data?.data || response.data;
      if (!payload?.ride) {
        return response.data;
      }
      const ride = await hydrateRideDriver(normalizeRide(payload.ride));
      return { ...response.data, data: { ride } };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  getRideHistory: async (page = 1, limit = 10): Promise<RidesResponse> => {
    const response = await axiosInstance.get('/rides/customer/history', {
      params: { page, limit },
    });
    const payload = response.data?.data || response.data;
    const meta = response.data?.meta || payload?.meta || {};
    const rides = await Promise.all((payload?.rides || []).map((ride: any) => hydrateRideDriver(normalizeRide(ride))));
    return {
      ...response.data,
      data: {
        rides,
        total: payload?.total ?? meta.total ?? rides.length,
        page: meta.page ?? page,
        limit: meta.limit ?? limit,
      },
    };
  },

  cancelRide: async (rideId: string, reason?: string): Promise<RideResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/cancel`, { reason });
    const payload = response.data?.data || response.data;
    const ride = await hydrateRideDriver(normalizeRide(payload.ride));
    return { ...response.data, data: { ride } };
  },
};
