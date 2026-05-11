import axiosInstance from './axios.config';
import { ApiResponse, Ride } from '../types';

const normalizeDistance = (distance: unknown): number | undefined => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return undefined;
  }

  return distance > 100 ? distance : distance * 1000;
};

const normalizeDistanceFromDriver = (distance: unknown): number | undefined => {
  if (typeof distance !== 'number' || Number.isNaN(distance) || distance < 0) {
    return undefined;
  }

  return distance > 100 ? distance : Math.round(distance * 1000);
};

const normalizeDurationFromDriver = (durationSeconds: unknown, etaMinutes: unknown): number | undefined => {
  if (typeof durationSeconds === 'number' && durationSeconds > 0) {
    return Math.round(durationSeconds);
  }

  if (typeof etaMinutes === 'number' && etaMinutes > 0) {
    return Math.round(etaMinutes * 60);
  }

  return undefined;
};

// Mirror the customer-app normalization so trip duration coming back from
// ride-service is always stored in seconds regardless of whether the producer
// sent a legacy minutes value (≤30 → treated as minutes) or a modern seconds
// value (>30 → kept as seconds). Without this, the driver app interpreted a
// legacy "25" as 25 seconds while the customer app saw 25 minutes — that's
// the source of the "lệch lệch" the user noticed between the two screens.
const normalizeTripDurationSeconds = (duration: unknown, estimatedDuration: unknown): number | undefined => {
  const raw = typeof duration === 'number' && duration > 0
    ? duration
    : typeof estimatedDuration === 'number' && estimatedDuration > 0
      ? estimatedDuration
      : undefined;
  if (raw == null) return undefined;
  return raw <= 30 ? Math.round(raw * 60) : Math.round(raw);
};

const normalizeRide = (ride: any): Ride => ({
  ...ride,
  pickupLocation: ride.pickupLocation || ride.pickup || {
    lat: ride.pickupLat,
    lng: ride.pickupLng,
    address: ride.pickupAddress,
  },
  dropoffLocation: ride.dropoffLocation || ride.dropoff || {
    lat: ride.dropoffLat,
    lng: ride.dropoffLng,
    address: ride.dropoffAddress,
  },
  distance: normalizeDistance(ride.distance),
  duration: normalizeTripDurationSeconds(ride.duration, ride.estimatedDuration),
  estimatedDuration: normalizeTripDurationSeconds(ride.estimatedDuration, ride.duration),
  distanceFromDriverMeters: normalizeDistanceFromDriver(ride.distanceFromDriverMeters ?? ride.distanceFromDriver),
  durationFromDriverSeconds: normalizeDurationFromDriver(ride.durationFromDriverSeconds, ride.etaMinutes),
  etaMinutes: typeof ride.etaMinutes === 'number' && ride.etaMinutes > 0 ? ride.etaMinutes : undefined,
});

const hydrateRideCustomer = (ride: Ride): Ride => ride;

export const rideApi = {
  // Get ride details
  getRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.get(`/rides/${rideId}`);
    const ride = hydrateRideCustomer(normalizeRide(response.data.data.ride));
    return {
      ...response.data,
      data: {
        ride,
      },
    };
  },

  // Accept ride
  acceptRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/drivers/me/rides/${rideId}/accept`, {});
    const ride = hydrateRideCustomer(normalizeRide(response.data.data.ride));
    return {
      ...response.data,
      data: {
        ride,
      },
    };
  },

  // Reject ride (already assigned)
  rejectRide: async (rideId: string): Promise<ApiResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/reject`, {});
    return response.data;
  },

  // Decline an offered ride (dismissing popup — triggers immediate re-dispatch)
  declineOffer: async (rideId: string): Promise<ApiResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/reject-offer`, { reason: 'Driver dismissed' });
    return response.data;
  },

  // Start ride (arrived at pickup, customer on board)
  pickupRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/pickup`, {});
    const ride = hydrateRideCustomer(normalizeRide(response.data.data.ride));
    return {
      ...response.data,
      data: {
        ride,
      },
    };
  },

  // Start ride (arrived at pickup, customer on board)
  startRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/start`, {});
    const ride = hydrateRideCustomer(normalizeRide(response.data.data.ride));
    return {
      ...response.data,
      data: {
        ride,
      },
    };
  },

  // Complete ride
  completeRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/complete`, {});
    const ride = hydrateRideCustomer(normalizeRide(response.data.data.ride));
    return {
      ...response.data,
      data: {
        ride,
      },
    };
  },

  // Cancel ride
  cancelRide: async (rideId: string, reason?: string): Promise<ApiResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/cancel`, { reason });
    return response.data;
  },

  // Get active ride for driver
  getActiveRide: async (): Promise<ApiResponse<{ ride: Ride | null }>> => {
    const response = await axiosInstance.get('/rides/driver/active');
    const ride = response.data?.data?.ride ?? response.data?.data ?? null;
    const hydratedRide = ride ? hydrateRideCustomer(normalizeRide(ride)) : null;
    return {
      ...response.data,
      data: {
        ride: hydratedRide,
      },
    };
  },

  getAvailableRides: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    vehicleType?: string;
  }): Promise<ApiResponse<{ rides: Ride[] }>> => {
    const response = await axiosInstance.get('/drivers/me/available-rides', {
      params,
    });
    return {
      ...response.data,
      data: {
        rides: (response.data.data?.rides || []).map(normalizeRide),
      },
    };
  },
};
