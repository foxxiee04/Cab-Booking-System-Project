import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (refreshToken) {
              const response = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
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
  async login(data: { email: string; password: string }) {
    return this.client.post('/api/auth/login', data);
  }

  async logout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    return this.client.post('/api/auth/logout', { refreshToken });
  }

  // Driver
  async goOnline() {
    return this.client.post('/api/drivers/online');
  }

  async goOffline() {
    return this.client.post('/api/drivers/offline');
  }

  async updateLocation(lat: number, lng: number) {
    return this.client.put('/api/drivers/location', { lat, lng });
  }

  async getDriverStatus() {
    return this.client.get('/api/drivers/status');
  }

  // Rides
  async acceptRide(rideId: string) {
    return this.client.post(`/api/rides/${rideId}/accept`);
  }

  async startRide(rideId: string) {
    return this.client.post(`/api/rides/${rideId}/start`);
  }

  async completeRide(rideId: string) {
    return this.client.post(`/api/rides/${rideId}/complete`);
  }

  async cancelRide(rideId: string, reason?: string) {
    return this.client.post(`/api/rides/${rideId}/cancel`, { reason });
  }

  async getCurrentRide() {
    return this.client.get('/api/rides/current');
  }

  // Earnings
  async getEarnings(page = 1, limit = 20) {
    return this.client.get(`/api/payments/driver/earnings?page=${page}&limit=${limit}`);
  }
}

export const apiClient = new ApiClient();
