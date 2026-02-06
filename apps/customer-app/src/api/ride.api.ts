import axiosInstance from './axios.config';
import { Ride, Location, VehicleType, PaymentMethod } from '../types';

export interface CreateRideRequest {
  pickup: Location;
  dropoff: Location;
  vehicleType?: VehicleType;
  paymentMethod?: PaymentMethod;
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

const normalizeRide = (ride: any): Ride => {
  const pickup = ride.pickup || ride.pickupLocation || (ride.pickupLat != null ? {
    lat: ride.pickupLat,
    lng: ride.pickupLng,
    address: ride.pickupAddress || '',
  } : undefined);

  const dropoff = ride.dropoff || ride.dropoffLocation || (ride.dropoffLat != null ? {
    lat: ride.dropoffLat,
    lng: ride.dropoffLng,
    address: ride.dropoffAddress || '',
  } : undefined);

  return {
    ...ride,
    pickup,
    dropoff,
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
    return { ...response.data, data: { ride: normalizeRide(payload.ride) } };
  },

  getRide: async (rideId: string): Promise<RideResponse> => {
    const response = await axiosInstance.get(`/rides/${rideId}`);
    const payload = response.data?.data || response.data;
    return { ...response.data, data: { ride: normalizeRide(payload.ride) } };
  },

  getActiveRide: async (): Promise<RideResponse | null> => {
    try {
      const response = await axiosInstance.get('/rides/customer/active');
      const payload = response.data?.data || response.data;
      if (!payload?.ride) {
        return response.data;
      }
      return { ...response.data, data: { ride: normalizeRide(payload.ride) } };
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
    const rides = (payload?.rides || []).map(normalizeRide);
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
    return { ...response.data, data: { ride: normalizeRide(payload.ride) } };
  },
};
