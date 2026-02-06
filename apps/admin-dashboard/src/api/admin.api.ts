import axiosInstance from './axios.config';
import { ApiResponse, SystemStats, Ride, Driver, Customer, Payment } from '../types';

export const adminApi = {
  // Get system statistics
  getStats: async (): Promise<ApiResponse<{ stats: SystemStats }>> => {
    const response = await axiosInstance.get('/admin/stats');
    return response.data;
  },

  // Get all rides with filters
  getRides: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ rides: Ride[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/rides', { params });
    return response.data;
  },

  // Get all drivers with normalized user data
  getDrivers: async (params?: {
    isOnline?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ drivers: Driver[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/drivers', { params });
    
    // Backend returns drivers with flat structure (userId instead of user object)
    // We need to normalize the data for frontend consumption
    const driversData = response.data.data || response.data;
    let drivers = driversData.drivers || [];
    
    // Transform backend format to frontend format
    // Backend: { id, userId, vehicleType, rating, totalRides, isOnline }
    // Frontend needs: { id, user: { firstName, lastName, email }, vehicleType, rating, totalRides, isOnline }
    
    // For now, we'll use userId as placeholder for user object
    // Ideally, backend should JOIN user data, but if not available, we normalize here
    drivers = drivers.map((driver: any) => ({
      ...driver,
      user: driver.user || {
        id: driver.userId,
        firstName: 'Driver',
        lastName: driver.id?.substring(0, 8) || 'N/A',
        email: driver.userId ? `driver-${driver.userId.substring(0, 8)}@system.local` : 'N/A',
      }
    }));
    
    return {
      ...response.data,
      data: {
        drivers,
        total: driversData.total || 0,
      }
    };
  },

  // Get all customers
  getCustomers: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ customers: Customer[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/customers', { params });
    return response.data;
  },

  // Get all payments
  getPayments: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ payments: Payment[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/payments', { params });
    return response.data;
  },

  // Get logs
  getLogs: async (params?: {
    level?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ logs: any[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/logs', { params });
    return response.data;
  },
};
