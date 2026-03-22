import axiosInstance from './axios.config';
import { ApiResponse, AuthResponse } from '../types';

export interface LoginRequest {
  phone: string;
  password: string;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await axiosInstance.post('/auth/login', data);
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

