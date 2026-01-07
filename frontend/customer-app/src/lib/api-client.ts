import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (refreshToken) {
              const response = await axios.post(`${API_URL}/api/auth/refresh`, {
                refreshToken,
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data.data;
              useAuthStore.getState().setTokens(accessToken, newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            }
          } catch {
            useAuthStore.getState().logout();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: { name: string; email: string; password: string; phone: string }) {
    const trimmedName = data.name.trim();
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || trimmedName;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

    return this.client.post('/api/auth/register', {
      email: data.email,
      password: data.password,
      phone: data.phone,
      role: 'CUSTOMER',
      firstName,
      ...(lastName ? { lastName } : {}),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.client.post('/api/auth/login', data);
  }

  async logout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    return this.client.post('/api/auth/logout', { refreshToken });
  }

  async getProfile() {
    return this.client.get('/api/auth/me');
  }

  // Rides
  async estimateRide(pickup: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    return this.client.post('/api/ai/ride/estimate', { pickup, destination });
  }

  async createRide(data: {
    pickup: { lat: number; lng: number; address?: string };
    dropoff: { lat: number; lng: number; address?: string };
  }) {
    return this.client.post('/api/rides', data);
  }

  async getRide(rideId: string) {
    return this.client.get(`/api/rides/${rideId}`);
  }

  async cancelRide(rideId: string, reason?: string) {
    return this.client.post(`/api/rides/${rideId}/cancel`, { reason });
  }

  async getRideHistory(page = 1, limit = 10) {
    return this.client.get(`/api/rides/customer/history?page=${page}&limit=${limit}`);
  }

  async getActiveRide() {
    return this.client.get('/api/rides/customer/active');
  }

  // Payments
  async getPaymentHistory(page = 1, limit = 10) {
    return this.client.get(`/api/payments/customer/history?page=${page}&limit=${limit}`);
  }
}

export const apiClient = new ApiClient();
