import axiosInstance from './axios.config';
import { User, AuthTokens } from '../types';

// ─── Request types ─────────────────────────────────────────────────────────

export interface RegisterRequest {
  phone: string;
  password: string;
  role: 'CUSTOMER';
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  phone: string;
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
  role: 'CUSTOMER';
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

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    tokens: AuthTokens;
  };
}

export interface UpdateProfileRequest {
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  email?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const normalizeUser = (user: any): User => ({
  id: user.id,
  email: user.email || undefined,
  role: user.role,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  phoneNumber: user.phoneNumber || user.phone || '',
  avatar: user.avatar || undefined,
});

// --- Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  /** Login with phone and password */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post('/auth/login', data);
    return {
      ...response.data,
      data: {
        ...response.data.data,
        user: normalizeUser(response.data.data.user),
      },
    };
  },

  /** Step 1 of registration: create account (auto-sends OTP) */
  register: async (data: RegisterRequest): Promise<{ success: boolean; data: { message: string; resendDelay: number } }> => {
    const response = await axiosInstance.post('/auth/register', data);
    return response.data;
  },

  /** Resend OTP for phone verification during registration */
  sendOtp: async (data: SendOtpRequest): Promise<{ success: boolean; data: { message: string; resendDelay: number } }> => {
    const response = await axiosInstance.post('/auth/send-otp', data);
    return response.data;
  },

  /** New registration flow step 1: send OTP to phone before entering profile */
  registerPhoneStart: async (data: RegisterPhoneStartRequest): Promise<{ success: boolean; data: { message: string; resendDelay: number } }> => {
    const response = await axiosInstance.post('/auth/register-phone/start', data);
    return response.data;
  },

  /** New registration flow step 2: verify OTP */
  registerPhoneVerify: async (data: RegisterPhoneVerifyRequest): Promise<{ success: boolean; data: { message: string } }> => {
    const response = await axiosInstance.post('/auth/register-phone/verify', data);
    return response.data;
  },

  /** New registration flow step 3: complete account profile and auto-login */
  registerPhoneComplete: async (data: RegisterPhoneCompleteRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post('/auth/register-phone/complete', data);
    return {
      ...response.data,
      data: {
        ...response.data.data,
        user: normalizeUser(response.data.data.user),
      },
    };
  },

  /** Verify OTP and receive JWT tokens */
  verifyOtp: async (data: VerifyOtpRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post('/auth/verify-otp', data);
    return {
      ...response.data,
      data: {
        ...response.data.data,
        user: normalizeUser(response.data.data.user),
      },
    };
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },

  getMe: async (): Promise<{ success: boolean; data: { user: User } }> => {
    const response = await axiosInstance.get('/auth/me');
    return {
      ...response.data,
      data: { user: normalizeUser(response.data.data.user) },
    };
  },

  updateMe: async (data: UpdateProfileRequest): Promise<{ success: boolean; data: { user: User } }> => {
    const response = await axiosInstance.patch('/auth/me', data);
    return {
      ...response.data,
      data: { user: normalizeUser(response.data.data.user) },
    };
  },

  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await axiosInstance.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  /** Forgot password: send OTP to phone */
  forgotPassword: async (data: ForgotPasswordRequest): Promise<{ success: boolean; data: { message: string; resendDelay: number } }> => {
    const response = await axiosInstance.post('/auth/forgot-password', data);
    return response.data;
  },

  /** Reset password: verify OTP and set new password */
  resetPassword: async (data: ResetPasswordRequest): Promise<{ success: boolean; data: { message: string } }> => {
    const response = await axiosInstance.post('/auth/reset-password', data);
    return response.data;
  },
};
