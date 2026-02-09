import axiosInstance from './axios.config';
import { ApiResponse, Ride } from '../types';

export const rideApi = {
  // Get ride details
  getRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.get(`/rides/${rideId}`);
    return response.data;
  },

  // Accept ride
  acceptRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/accept`);
    return response.data;
  },

  // Reject ride
  rejectRide: async (rideId: string): Promise<ApiResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/reject`);
    return response.data;
  },

  // Start ride (arrived at pickup, customer on board)
  startRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/start`);
    return response.data;
  },

  // Complete ride
  completeRide: async (rideId: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await axiosInstance.post(`/rides/${rideId}/complete`);
    return response.data;
  },

  // Cancel ride
  cancelRide: async (rideId: string, reason?: string): Promise<ApiResponse> => {
    const response = await axiosInstance.post(`/rides/${rideId}/cancel`, { reason });
    return response.data;
  },

  // Get active ride for driver
  getActiveRide: async (): Promise<ApiResponse<{ ride: Ride | null }>> => {
    const response = await axiosInstance.get('/rides/driver/active');
    return response.data;
  },
};
