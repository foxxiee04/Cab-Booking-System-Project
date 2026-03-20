import axiosInstance from './axios.config';
import { User, AuthTokens } from '../types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  role: 'CUSTOMER';
  firstName: string;
  lastName: string;
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
  phone?: string;
}

const normalizeUser = (user: any): User => ({
  id: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  phoneNumber: user.phoneNumber || user.phone || undefined,
  avatar: user.avatar || undefined,
});

export const authApi = {
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

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post('/auth/register', data);
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
      data: {
        user: normalizeUser(response.data.data.user),
      },
    };
  },

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
