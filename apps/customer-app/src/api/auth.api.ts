import axiosInstance from './axios.config';
import { User, AuthTokens } from '../types';

// ─── Request types ─────────────────────────────────────────────────────────

export interface RegisterRequest {
  phone: string;
  role: 'CUSTOMER';
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

// ─── Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  /** Step 1 of registration: create account (sends OTP automatically) */
  register: async (data: RegisterRequest): Promise<{ success: boolean; data: { message: string } }> => {
    const response = await axiosInstance.post('/auth/register', data);
    return response.data;
  },

  /** Request OTP to phone for login */
  sendOtp: async (data: SendOtpRequest): Promise<{ success: boolean; data: { message: string; resendDelay: number } }> => {
    const response = await axiosInstance.post('/auth/send-otp', data);
    return response.data;
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
};


  updateMe: async (data: UpdateProfileRequest): Promise<{ success: boolean; data: { user: User } }> => {
    const response = await axiosInstance.patch('/auth/me', data);
    return {
      ...response.data,
      data: {
        user: normalizeUser(response.data.data.user),
      },
    };
  },

  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await axiosInstance.post('/auth/refresh', { refreshToken });
    return response.data;
  },
};
