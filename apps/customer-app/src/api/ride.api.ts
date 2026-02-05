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

export const rideApi = {
  createRide: async (data: CreateRideRequest): Promise<RideResponse> => {
    const response = await axiosInstance.post('/rides', data);
    return response.data;
  },

  getRide: async (rideId: string): Promise<RideResponse> => {
    const response = await axiosInstance.get(`/rides/${rideId}`);
    return response.data;
  },

  getActiveRide: async (): Promise<RideResponse | null> => {
    try {
      const response = await axiosInstance.get('/rides/customer/active');
      return response.data;
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
    return response.data;
  },

  cancelRide: async (rideId: string, reason?: string): Promise<RideResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/cancel`, { reason });
    return response.data;
  },
};
