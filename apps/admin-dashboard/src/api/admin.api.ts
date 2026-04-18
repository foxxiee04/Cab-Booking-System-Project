import axiosInstance from './axios.config';
import { ApiResponse, SystemStats, Ride, Driver, Customer, Payment, Voucher, VoucherAudience, VoucherDiscountType } from '../types';

type AdminVoucherPayload = {
  code: string;
  description?: string;
  audienceType: VoucherAudience;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscount?: number;
  minFare?: number;
  startTime: string;
  endTime: string;
  usageLimit?: number;
  perUserLimit?: number;
  isActive?: boolean;
};

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
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ drivers: Driver[]; total: number }>> => {
    const response = await axiosInstance.get('/admin/drivers', { params });
    return response.data;
  },

  approveDriver: async (driverId: string): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post(`/admin/drivers/${driverId}/approve`);
    return response.data;
  },

  rejectDriver: async (driverId: string, reason?: string): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post(`/admin/drivers/${driverId}/reject`, { reason });
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

  getVouchers: async (): Promise<ApiResponse<{ vouchers: Voucher[] }>> => {
    const response = await axiosInstance.get('/voucher/admin');
    return {
      ...response.data,
      data: {
        vouchers: response.data?.data || [],
      },
    };
  },

  createVoucher: async (payload: AdminVoucherPayload): Promise<ApiResponse<{ voucher: Voucher }>> => {
    const response = await axiosInstance.post('/voucher/admin', payload);
    return {
      ...response.data,
      data: {
        voucher: response.data?.data,
      },
    };
  },

  updateVoucher: async (voucherId: string, payload: AdminVoucherPayload): Promise<ApiResponse<{ voucher: Voucher }>> => {
    const response = await axiosInstance.patch(`/voucher/admin/${voucherId}`, payload);
    return {
      ...response.data,
      data: {
        voucher: response.data?.data,
      },
    };
  },

  toggleVoucher: async (voucherId: string, isActive: boolean): Promise<ApiResponse<{ voucher: Voucher }>> => {
    const response = await axiosInstance.patch(`/voucher/admin/${voucherId}/toggle`, { isActive });
    return {
      ...response.data,
      data: {
        voucher: response.data?.data,
      },
    };
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
