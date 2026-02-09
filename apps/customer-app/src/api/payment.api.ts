import axiosInstance from './axios.config';
import { Payment } from '../types';

export interface PaymentResponse {
  success: boolean;
  data: Payment;
}

export const paymentApi = {
  getPaymentByRide: async (rideId: string): Promise<PaymentResponse> => {
    const response = await axiosInstance.get(`/payments/ride/${rideId}`);
    return response.data;
  },

  // Payment retry - NOT IMPLEMENTED IN BACKEND
  // Backend limitation: POST /payments/:paymentId/retry endpoint does not exist
  // For production, either implement in backend or remove retry button from UI
  retryPayment: async (paymentId: string): Promise<PaymentResponse> => {
    throw new Error('Payment retry is not supported. Please contact support.');
  },
};
