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

  // Get pricing history - NOT IMPLEMENTED IN BACKEND
  // Backend limitation: /pricing/surge/history endpoint does not exist
  // Consider implementing in backend or remove from UI
  getSurgeHistory: async (): Promise<ApiResponse<{ history: SurgePricing[] }>> => {
    // Return empty history instead of calling non-existent endpoint
    return {
      success: true,
      data: { history: [] }
    };
  },
};
