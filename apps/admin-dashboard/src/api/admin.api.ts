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

  // Get all drivers
  getDrivers: async (params?: {
    isOnline?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ drivers: Driver[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/drivers', { params });
    return response.data;
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
