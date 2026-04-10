import axiosInstance from './axios.config';
import { ApiResponse, AuthResponse } from '../types';

export interface RegisterRequest {
  phone: string;
  password: string;
  role: 'DRIVER';
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface SendOtpRequest {
  phone: string;
}

export interface RegisterPhoneStartRequest {
  phone: string;
}

export interface RegisterPhoneVerifyRequest {
  phone: string;
  otp: string;
}

export interface RegisterPhoneCompleteRequest {
  phone: string;
  password: string;
  role: 'DRIVER';
  firstName?: string;
  lastName?: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  phone: string;
}

export interface ResetPasswordRequest {
  phone: string;
  otp: string;
  newPassword: string;
}

export interface OtpDeliveryPayload {
  message: string;
  resendDelay: number;
  expiresInSeconds?: number;
  maxAttempts?: number;
  deliveryMethod?: 'SERVER_LOG' | 'SMS';
}

const normalizeUser = (user: any) => ({
  ...user,
  phoneNumber: user.phoneNumber || user.phone || '',
});

export const authApi = {
  login: async (data: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await axiosInstance.post('/auth/login', data);
    const result = response.data;
    if (result.success && result.data?.user) {
      result.data.user = normalizeUser(result.data.user);
    }
    return result;
  },

  register: async (data: RegisterRequest): Promise<ApiResponse<OtpDeliveryPayload>> => {
    const response = await axiosInstance.post('/auth/register', data);
    return response.data;
  },

  sendOtp: async (data: SendOtpRequest): Promise<ApiResponse<OtpDeliveryPayload>> => {
    const response = await axiosInstance.post('/auth/send-otp', data);
    return response.data;
  },

  registerPhoneStart: async (data: RegisterPhoneStartRequest): Promise<ApiResponse<OtpDeliveryPayload>> => {
    const response = await axiosInstance.post('/auth/register-phone/start', data);
    return response.data;
  },

  registerPhoneVerify: async (data: RegisterPhoneVerifyRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await axiosInstance.post('/auth/register-phone/verify', data);
    return response.data;
  },

  registerPhoneComplete: async (data: RegisterPhoneCompleteRequest): Promise<ApiResponse<AuthResponse>> => {
    const response = await axiosInstance.post('/auth/register-phone/complete', data);
    const result = response.data;
    if (result.success && result.data?.user) {
      result.data.user = normalizeUser(result.data.user);
    }
    return result;
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

  /** Forgot password: send OTP to phone */
  forgotPassword: async (data: ForgotPasswordRequest): Promise<ApiResponse<OtpDeliveryPayload>> => {
    const response = await axiosInstance.post('/auth/forgot-password', data);
    return response.data;
  },

  /** Reset password: verify OTP and set new password */
  resetPassword: async (data: ResetPasswordRequest): Promise<ApiResponse<{ message: string }>> => {
    const response = await axiosInstance.post('/auth/reset-password', data);
    return response.data;
  },
};
