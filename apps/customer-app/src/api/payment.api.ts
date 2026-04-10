import axios from 'axios';
import axiosInstance from './axios.config';
import { Payment } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export interface PaymentResponse {
  success: boolean;
  data: {
    payment: Payment;
  };
}

export interface GatewayCreateResponse {
  success: boolean;
  data: {
    paymentUrl?: string;
    payUrl?: string;
    deeplink?: string;
    qrCodeUrl?: string;
    paymentId?: string;
    paymentIntentId?: string;
    status?: string;
  };
}

export interface GatewayReturnResponse {
  success: boolean;
  data: {
    rideId?: string;
    paid?: boolean;
    responseCode?: string;
    resultCode?: number;
    transactionId?: string;
    message?: string;
  };
}

export const paymentApi = {
  createMomoPayment: async (params: {
    rideId: string;
    amount: number;
    returnUrl?: string;
  }): Promise<GatewayCreateResponse> => {
    const response = await axiosInstance.post('/payments/momo/create', params);
    const payload = response.data?.data || {};
    const metadata = payload.metadata || {};

    const paymentUrl = payload.paymentUrl || metadata.paymentUrl;
    const payUrl = payload.payUrl || metadata.payUrl || paymentUrl;

    return {
      success: Boolean(response.data?.success),
      data: {
        paymentUrl,
        payUrl,
        deeplink: payload.deeplink || metadata.deeplink,
        qrCodeUrl: payload.qrCodeUrl || metadata.qrCodeUrl,
        paymentId: payload.paymentId,
        paymentIntentId: payload.paymentIntentId,
        status: payload.status,
      },
    };
  },

  createVnpayPayment: async (params: {
    rideId: string;
    amount: number;
    returnUrl?: string;
    bankCode?: string;
  }): Promise<GatewayCreateResponse> => {
    const response = await axiosInstance.post('/payments/vnpay/create', params);
    const payload = response.data?.data || {};
    const metadata = payload.metadata || {};

    const paymentUrl = payload.paymentUrl || metadata.paymentUrl;
    const payUrl = payload.payUrl || metadata.payUrl || paymentUrl;

    return {
      success: Boolean(response.data?.success),
      data: {
        paymentUrl,
        payUrl,
        deeplink: payload.deeplink || metadata.deeplink,
        qrCodeUrl: payload.qrCodeUrl || metadata.qrCodeUrl,
        paymentId: payload.paymentId,
        paymentIntentId: payload.paymentIntentId,
        status: payload.status,
      },
    };
  },

  confirmMomoReturn: async (searchParams: URLSearchParams): Promise<GatewayReturnResponse> => {
    const response = await axios.get(`${API_BASE_URL}/payments/momo/return?${searchParams.toString()}`);
    return response.data;
  },

  confirmVnpayReturn: async (searchParams: URLSearchParams): Promise<GatewayReturnResponse> => {
    const response = await axios.get(`${API_BASE_URL}/payments/vnpay/return?${searchParams.toString()}`);
    return response.data;
  },

  getPaymentByRide: async (rideId: string): Promise<PaymentResponse> => {
    const response = await axiosInstance.get(`/payments/ride/${rideId}`);
    const payload = response.data?.data || response.data;
    return {
      ...response.data,
      data: {
        payment: payload?.payment || payload,
      },
    };
  },

  getCustomerPaymentHistory: async (
    page = 1,
    limit = 50,
  ): Promise<{ success: boolean; data: { payments: Payment[]; total: number } }> => {
    const response = await axiosInstance.get('/payments/customer/history', {
      params: { page, limit },
    });
    const payload = response.data?.data || response.data;
    return {
      success: Boolean(response.data?.success),
      data: {
        payments: payload?.payments || [],
        total: payload?.total || 0,
      },
    };
  },

  // Payment retry - NOT IMPLEMENTED IN BACKEND
  // Backend limitation: POST /payments/:paymentId/retry endpoint does not exist
  // For production, either implement in backend or remove retry button from UI
  retryPayment: async (paymentId: string): Promise<PaymentResponse> => {
    throw new Error('Payment retry is not supported. Please contact support.');
  },
};
