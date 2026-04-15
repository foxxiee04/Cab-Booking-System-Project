import axiosInstance from './axios.config';
import { ApiResponse, Ride } from '../types';

const normalizeDistance = (distance: unknown): number | undefined => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return undefined;
  }

  return distance > 100 ? distance : distance * 1000;
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
  duration: typeof ride.duration === 'number' ? ride.duration : ride.estimatedDuration,
});

const hydrateRideCustomer = async (ride: Ride): Promise<Ride> => {
  if (ride.customer || !ride.customerId) {
    return ride;
  }

  try {
    const response = await axiosInstance.get(`/users/${ride.customerId}`);
    const customer = response.data?.data?.user;

    if (!customer) {
      return ride;
    }

    return {
      ...ride,
      customer: {
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phoneNumber: customer.phone || customer.phoneNumber,
      },
    };
  } catch {
    return ride;
  }
};

export const rideApi = {
  // Get ride details
  getRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.get(`/rides/${rideId}`);
    const ride = await hydrateRideCustomer(normalizeRide(response.data.data.ride));
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
    const ride = await hydrateRideCustomer(normalizeRide(response.data.data.ride));
    return {
      ...response.data,
      data: {
        ride,
      },
    };
  },

  // Reject ride
  rejectRide: async (rideId: string): Promise<ApiResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/reject`, {});
    return response.data;
  },

  // Start ride (arrived at pickup, customer on board)
  pickupRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/pickup`, {});
    const ride = await hydrateRideCustomer(normalizeRide(response.data.data.ride));
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
    const ride = await hydrateRideCustomer(normalizeRide(response.data.data.ride));
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
    const ride = await hydrateRideCustomer(normalizeRide(response.data.data.ride));
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
    const hydratedRide = ride ? await hydrateRideCustomer(normalizeRide(ride)) : null;
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
