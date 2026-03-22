import axiosInstance from './axios.config';
import { ApiResponse, AuthResponse } from '../types';

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export const authApi = {
  sendOtp: async (data: SendOtpRequest): Promise<ApiResponse<{ resendDelay: number }>> => {
    const response = await axiosInstance.post('/auth/send-otp', data);
    return response.data;
  },

  verifyOtp: async (data: VerifyOtpRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await axiosInstance.post('/auth/verify-otp', data);
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: any }>> => {
    const response = await axiosInstance.get('/auth/me');
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
