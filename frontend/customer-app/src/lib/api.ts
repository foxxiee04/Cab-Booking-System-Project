import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiClientConfig {
  getTokens: () => AuthTokens | null;
  setTokens: (tokens: AuthTokens) => void;
  onLogout: () => void;
}

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const tokens = this.config.getTokens();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
      return config;
    });

    // Handle 401 and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const tokens = this.config.getTokens();
            if (tokens?.refreshToken) {
              const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
                refreshToken: tokens.refreshToken,
              });

              const newTokens = {
                accessToken: data.data.accessToken,
                refreshToken: data.data.refreshToken,
              };
              this.config.setTokens(newTokens);

              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              return this.client(originalRequest);
            }
          } catch {
            this.config.onLogout();
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth APIs
  async register(data: { email: string; password: string; phone: string; firstName: string; lastName: string }) {
    return this.client.post('/api/auth/register', { ...data, role: 'CUSTOMER' });
  }

  async login(credentials: { email: string; password: string }) {
    return this.client.post('/api/auth/login', credentials);
  }

  async logout() {
    const tokens = this.config.getTokens();
    if (tokens?.refreshToken) {
      await this.client.post('/api/auth/logout', { refreshToken: tokens.refreshToken });
    }
  }

  async getProfile() {
    return this.client.get('/api/auth/me');
  }

  // Ride APIs
  async estimateRide(pickup: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    return this.client.post('/api/ai/ride/estimate', { pickup, destination });
  }

  async createRide(data: {
    pickup: {
      lat: number;
      lng: number;
      address: string;
    };
    dropoff: {
      lat: number;
      lng: number;
      address: string;
    };
    vehicleType?: string;
    paymentMethod?: string;
  }) {
    return this.client.post('/api/rides', data);
  }

  async getRide(rideId: string) {
    return this.client.get(`/api/rides/${rideId}`);
  }

  async getRideHistory(page = 1, limit = 20) {
    return this.client.get(`/api/rides/customer/history?page=${page}&limit=${limit}`);
  }

  async getActiveRide() {
    return this.client.get('/api/rides/customer/active');
  }

  async cancelRide(rideId: string, reason?: string) {
    return this.client.post(`/api/rides/${rideId}/cancel`, { reason });
  }

  // Payment APIs
  async getPaymentHistory(page = 1, limit = 20) {
    return this.client.get(`/api/payments/customer/history?page=${page}&limit=${limit}`);
  }

  // Geo APIs
  async searchPlaces(query: string, lat?: number, lng?: number) {
    const params = new URLSearchParams({ q: query });
    if (lat && lng) {
      params.append('lat', lat.toString());
      params.append('lng', lng.toString());
    }
    return this.client.get(`/api/geo/autocomplete?${params}`);
  }

  async reverseGeocode(lat: number, lng: number) {
    return this.client.get(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
  }

  // Review APIs
  async createReview(data: { rideId: string; rating: number; comment?: string }) {
    return this.client.post('/api/reviews', data);
  }

  async getRideReview(rideId: string) {
    return this.client.get(`/api/reviews/ride/${rideId}`);
  }
}
