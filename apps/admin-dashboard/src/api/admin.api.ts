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

  // Revenue analytics (time-series for charts)
  getRevenueAnalytics: async (days = 30): Promise<ApiResponse<{
    dailyRevenue: Array<{ date: string; revenue: number; trips: number }>;
    methodBreakdown: Record<string, number>;
    totalRevenue: number;
    totalTrips: number;
  }>> => {
    const response = await axiosInstance.get('/admin/analytics/revenue', { params: { days } });
    return response.data;
  },

  // Top drivers by ride count (also includes rating + earnings for sortable charts)
  getTopDrivers: async (limit = 10): Promise<ApiResponse<{
    drivers: Array<{
      id: string;
      name: string;
      totalRides: number;
      rating: number;
      reviewCount?: number;
      totalEarnings?: number;
      vehicleType: string;
    }>;
  }>> => {
    const response = await axiosInstance.get('/admin/analytics/top-drivers', { params: { limit } });
    return response.data;
  },

  // Vehicle breakdown for revenue reports (rides + revenue per vehicle type)
  getVehicleBreakdown: async (days = 30): Promise<ApiResponse<{
    breakdown: Array<{ vehicleType: string; count: number; revenue: number }>;
    total: number;
  }>> => {
    const response = await axiosInstance.get('/admin/analytics/vehicles', { params: { days } });
    return response.data;
  },

  // Top customers by ride count
  getTopCustomers: async (limit = 10): Promise<ApiResponse<{
    customers: Array<{ id: string; name: string; email: string; totalRides: number }>;
  }>> => {
    const response = await axiosInstance.get('/admin/analytics/top-customers', { params: { limit } });
    return response.data;
  },

  // Toggle user status (ACTIVE / INACTIVE / SUSPENDED)
  updateUserStatus: async (userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/status`, { status });
    return response.data;
  },

  // Suspend / unsuspend driver
  suspendDriver: async (driverId: string, suspend: boolean): Promise<ApiResponse<any>> => {
    const response = await axiosInstance.patch(`/admin/drivers/${driverId}/suspend`, { suspend });
    return response.data;
  },
};
