import axiosInstance from './axios.config';
import { ApiResponse, SurgePricing } from '../types';

export const pricingApi = {
  // Get current surge pricing
  getSurge: async (): Promise<ApiResponse<{ multiplier: number; reason: string }>> => {
    const response = await axiosInstance.get('/pricing/surge');
    return response.data;
  },

  // Update surge pricing
  updateSurge: async (data: {
    multiplier: number;
    reason?: string;
  }): Promise<ApiResponse<{ surge: SurgePricing }>> => {
    const response = await axiosInstance.post('/pricing/surge', data);
    return response.data;
  },

  // Get pricing history
  getSurgeHistory: async (): Promise<ApiResponse<{ history: SurgePricing[] }>> => {
    const response = await axiosInstance.get('/pricing/surge/history');
    return response.data;
  },
};
