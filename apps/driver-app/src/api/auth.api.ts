import axiosInstance from './axios.config';
import { ApiResponse, AuthResponse } from '../types';

export interface RegisterRequest {
  phone: string;
  role: 'DRIVER';
  firstName?: string;
  lastName?: string;
}

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

const normalizeUser = (user: any) => ({
  ...user,
  phoneNumber: user.phoneNumber || user.phone || '',
});

export const authApi = {
  register: async (data: RegisterRequest): Promise<ApiResponse<{ userId: string }>> => {
    const response = await axiosInstance.post('/auth/register', data);
    return response.data;
  },

  sendOtp: async (data: SendOtpRequest): Promise<ApiResponse<{ resendDelay: number }>> => {
    const response = await axiosInstance.post('/auth/send-otp', data);
    return response.data;
  },

  verifyOtp: async (data: VerifyOtpRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await axiosInstance.post('/auth/verify-otp', data);
    const result = response.data;
    if (result.success && result.data?.user) {
      result.data.user = normalizeUser(result.data.user);
    }
    return result;
  },

  getMe: async (): Promise<ApiResponse<{ user: any }>> => {
    const response = await axiosInstance.get('/auth/me');
    return response.data;
  },

  updateMe: async (data: { firstName?: string; lastName?: string; avatar?: string; email?: string }): Promise<ApiResponse<{ user: any }>> => {
    const response = await axiosInstance.patch('/auth/me', data);
    return response.data;
  },

  logout: async (): Promise<ApiResponse> => {
    const response = await axiosInstance.post('/auth/logout');
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ tokens: any }>> => {
    const response = await axiosInstance.post('/auth/refresh', { refreshToken });
    return response.data;
  },
};
