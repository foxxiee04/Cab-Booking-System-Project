import axios, { AxiosInstance } from 'axios';
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
  }

  // Auth
  async login(data: { email: string; password: string }) {
    return this.client.post('/api/auth/login', data);
  }

  async logout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    return this.client.post('/api/auth/logout', { refreshToken });
  }

  // Dashboard Stats
  async getDashboardStats() {
    return this.client.get('/api/admin/stats');
  }

  // Users
  async getUsers(page = 1, limit = 20) {
    return this.client.get(`/api/admin/users?page=${page}&limit=${limit}`);
  }

  async updateUserStatus(userId: string, status: string) {
    return this.client.patch(`/api/admin/users/${userId}/status`, { status });
  }

  // Drivers
  async getDrivers(page = 1, limit = 20) {
    return this.client.get(`/api/admin/drivers?page=${page}&limit=${limit}`);
  }

  async approveDriver(driverId: string) {
    return this.client.post(`/api/admin/drivers/${driverId}/approve`);
  }

  async suspendDriver(driverId: string, reason: string) {
    return this.client.post(`/api/admin/drivers/${driverId}/suspend`, { reason });
  }

  // Rides
  async getRides(page = 1, limit = 20, status?: string) {
    let url = `/api/admin/rides?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return this.client.get(url);
  }

  async getRideDetails(rideId: string) {
    return this.client.get(`/api/rides/${rideId}`);
  }

  // Payments
  async getPayments(page = 1, limit = 20) {
    return this.client.get(`/api/admin/payments?page=${page}&limit=${limit}`);
  }

  async refundPayment(rideId: string, reason: string) {
    return this.client.post(`/api/payments/ride/${rideId}/refund`, { reason });
  }

  // Reports
  async getRevenueReport(startDate: string, endDate: string) {
    return this.client.get(`/api/admin/reports/revenue?start=${startDate}&end=${endDate}`);
  }

  async getRideReport(startDate: string, endDate: string) {
    return this.client.get(`/api/admin/reports/rides?start=${startDate}&end=${endDate}`);
  }
}

export const apiClient = new ApiClient();
