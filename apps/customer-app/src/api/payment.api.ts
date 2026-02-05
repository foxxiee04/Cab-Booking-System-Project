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

  retryPayment: async (paymentId: string): Promise<PaymentResponse> => {
    const response = await axiosInstance.post(`/payments/${paymentId}/retry`);
    return response.data;
  },
};
