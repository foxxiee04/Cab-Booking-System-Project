import axiosInstance from './axios.config';
import { ApiResponse, Driver, DriverRegistration, Location, Earnings } from '../types';

export const driverApi = {
  // Register as driver (complete profile)
  registerDriver: async (data: DriverRegistration): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/register', data);
    return response.data;
  },

  // Get driver profile
  getProfile: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.get('/drivers/me');
    return response.data;
  },

  // Update driver profile
  updateProfile: async (data: Partial<Driver>): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.put('/drivers/me', data);
    return response.data;
  },

  // Go online
  goOnline: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/me/online');
    return response.data;
  },

  // Go offline
  goOffline: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/me/offline');
    return response.data;
  },

  // Update location
  updateLocation: async (location: Location): Promise<ApiResponse> => {
    const response = await axiosInstance.post('/drivers/me/location', { location });
    return response.data;
  },

  // Get earnings
  getEarnings: async (): Promise<ApiResponse<{ earnings: Earnings }>> => {
    const response = await axiosInstance.get('/drivers/me/earnings');
    return response.data;
  },

  // Get ride history
  getRideHistory: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ rides: any[]; total: number }>> => {
    const response = await axiosInstance.get('/drivers/me/rides', { params });
    return response.data;
  },
};
