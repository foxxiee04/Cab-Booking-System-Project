/**
 * Shared API Client for all frontend applications
 * Handles authentication, request/response interceptors, and error handling
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_TIMEOUT = 10000;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  avatar?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

class ApiClient {
  private client: AxiosInstance;
  private tokenStore: {
    getTokens: () => AuthTokens | null;
    setTokens: (tokens: AuthTokens) => void;
    removeTokens: () => void;
  };

  constructor(tokenStore: {
    getTokens: () => AuthTokens | null;
    setTokens: (tokens: AuthTokens) => void;
    removeTokens: () => void;
  }) {
    this.tokenStore = tokenStore;

    this.client = axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const tokens = this.tokenStore.getTokens();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
      return config;
    });

    // Response interceptor - handle token refresh and errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 - Try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry && originalRequest) {
          originalRequest._retry = true;

          try {
            const tokens = this.tokenStore.getTokens();
            if (tokens?.refreshToken) {
              const response = await axios.post(`${API_URL}/api/auth/refresh`, {
                refreshToken: tokens.refreshToken,
              });

              const { accessToken, refreshToken } = response.data.data;
              this.tokenStore.setTokens({ accessToken, refreshToken });

              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              }
              return this.client(originalRequest);
            }
          } catch {
            this.tokenStore.removeTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ============ Auth Endpoints ============

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    role?: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  }) {
    const response = await this.client.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      '/api/auth/register',
      {
        ...data,
        role: data.role || 'CUSTOMER',
      }
    );
    return response.data;
  }

  async login(data: { email: string; password: string }) {
    const response = await this.client.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      '/api/auth/login',
      data
    );
    return response.data;
  }

  async logout() {
    const tokens = this.tokenStore.getTokens();
    if (tokens?.refreshToken) {
      try {
        await this.client.post('/api/auth/logout', { refreshToken: tokens.refreshToken });
      } catch {
        // Ignore errors on logout
      }
    }
    this.tokenStore.removeTokens();
  }

  async getProfile() {
    const response = await this.client.get<ApiResponse<{ user: User }>>('/api/auth/me');
    return response.data;
  }

  async refreshToken() {
    const tokens = this.tokenStore.getTokens();
    if (!tokens?.refreshToken) throw new Error('No refresh token available');

    const response = await this.client.post<ApiResponse<AuthTokens>>('/api/auth/refresh', {
      refreshToken: tokens.refreshToken,
    });
    return response.data;
  }

  // ============ Booking Endpoints ============

  async createBooking(data: {
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    vehicleType?: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
    paymentMethod?: 'CASH' | 'CARD' | 'WALLET';
    notes?: string;
  }) {
    const response = await this.client.post('/api/bookings', data);
    return response.data;
  }

  async confirmBooking(bookingId: string) {
    const response = await this.client.post(`/api/bookings/${bookingId}/confirm`);
    return response.data;
  }

  async getBooking(bookingId: string) {
    const response = await this.client.get(`/api/bookings/${bookingId}`);
    return response.data;
  }

  async getCustomerBookings(page = 1, limit = 20) {
    const response = await this.client.get(`/api/bookings`, { params: { page, limit } });
    return response.data;
  }

  // ============ Ride Endpoints ============

  async createRide(data: {
    pickup: { lat: number; lng: number; address?: string };
    dropoff: { lat: number; lng: number; address?: string };
    vehicleType?: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
    paymentMethod?: 'CASH' | 'CARD' | 'WALLET';
  }) {
    const response = await this.client.post('/api/rides', {
      pickupLat: data.pickup.lat,
      pickupLng: data.pickup.lng,
      pickupAddress: data.pickup.address,
      dropoffLat: data.dropoff.lat,
      dropoffLng: data.dropoff.lng,
      dropoffAddress: data.dropoff.address,
      vehicleType: data.vehicleType || 'ECONOMY',
      paymentMethod: data.paymentMethod || 'CASH',
    });
    return response.data;
  }

  async getRide(rideId: string) {
    const response = await this.client.get(`/api/rides/${rideId}`);
    return response.data;
  }

  async getRideList(page = 1, limit = 20, status?: string) {
    const params: any = { page, limit };
    if (status) params.status = status;
    const response = await this.client.get('/api/rides', { params });
    return response.data;
  }

  async acceptRide(rideId: string) {
    const response = await this.client.post(`/api/rides/${rideId}/accept`);
    return response.data;
  }

  async startRide(rideId: string) {
    const response = await this.client.post(`/api/rides/${rideId}/start`);
    return response.data;
  }

  async pickupRide(rideId: string) {
    const response = await this.client.post(`/api/rides/${rideId}/pickup`);
    return response.data;
  }

  async completeRide(rideId: string, data?: { rating?: number; feedback?: string }) {
    const response = await this.client.post(`/api/rides/${rideId}/complete`, data);
    return response.data;
  }

  async cancelRide(rideId: string, reason?: string) {
    const response = await this.client.post(`/api/rides/${rideId}/cancel`, { reason });
    return response.data;
  }

  async getAvailableRides(lat: number, lng: number, radius = 5, vehicleType?: string) {
    const params: any = { lat, lng, radius };
    if (vehicleType) params.vehicleType = vehicleType;
    const response = await this.client.get('/api/rides/available', { params });
    return response.data;
  }

  async estimateRide(pickupLocation: { lat: number; lng: number }, destinationLocation: { lat: number; lng: number }, vehicleType?: string) {
    const params: any = { 
      pickup_lat: pickupLocation.lat,
      pickup_lng: pickupLocation.lng,
      dest_lat: destinationLocation.lat,
      dest_lng: destinationLocation.lng,
    };
    if (vehicleType) params.vehicle_type = vehicleType;
    const response = await this.client.get('/api/ai/ride/estimate', { params });
    return response.data;
  }

  // ============ Driver Endpoints ============

  async registerDriver(data: {
    vehicle: {
      type: string;
      brand: string;
      model: string;
      plate: string;
      color: string;
      year: number;
    };
    license: {
      number: string;
      expiryDate: string;
    };
  }) {
    const response = await this.client.post('/api/drivers/register', data);
    return response.data;
  }

  async getDriverProfile() {
    const response = await this.client.get('/api/drivers/me');
    return response.data;
  }

  async goOnline() {
    const response = await this.client.post('/api/drivers/me/online');
    return response.data;
  }

  async goOffline() {
    const response = await this.client.post('/api/drivers/me/offline');
    return response.data;
  }

  async updateDriverLocation(lat: number, lng: number) {
    const response = await this.client.post('/api/drivers/me/location', { lat, lng });
    return response.data;
  }

  async getDriverEarnings(page = 1, limit = 20) {
    const response = await this.client.get('/api/drivers/me/earnings', { params: { page, limit } });
    return response.data;
  }

  // ============ Payment Endpoints ============

  async getPaymentStatus(rideId: string) {
    const response = await this.client.get(`/api/payments/${rideId}`);
    return response.data;
  }

  async initiatePayment(rideId: string, data: { amount: number; method: 'CASH' | 'CARD' | 'WALLET' }) {
    const response = await this.client.post(`/api/payments/${rideId}`, data);
    return response.data;
  }

  // ============ Admin Endpoints ============

  async getDashboardStats() {
    const response = await this.client.get('/api/admin/stats');
    return response.data;
  }

  async getUsers(page = 1, limit = 20) {
    const response = await this.client.get('/api/admin/users', { params: { page, limit } });
    return response.data;
  }

  async getDrivers(page = 1, limit = 20, status?: string) {
    const params: any = { page, limit };
    if (status) params.status = status;
    const response = await this.client.get('/api/admin/drivers', { params });
    return response.data;
  }

  async approveDriver(driverId: string) {
    const response = await this.client.post(`/api/admin/drivers/${driverId}/approve`);
    return response.data;
  }

  async suspendDriver(driverId: string, reason: string) {
    const response = await this.client.post(`/api/admin/drivers/${driverId}/suspend`, { reason });
    return response.data;
  }

  async getAllRides(page = 1, limit = 20, status?: string) {
    const params: any = { page, limit };
    if (status) params.status = status;
    const response = await this.client.get('/api/admin/rides', { params });
    return response.data;
  }

  // ============ Utility Methods ============

  async request<T = any>(method: string, url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.request<T>({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  }
}

export { ApiClient };
export type { ApiResponse, User, AuthTokens };
export default ApiClient;
