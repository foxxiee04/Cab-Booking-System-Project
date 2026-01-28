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

    this.client.interceptors.request.use((config) => {
      const tokens = this.config.getTokens();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
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

  // Auth
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

  // Driver APIs
  async getDriverProfile() {
    return this.client.get('/api/drivers/me');
  }

  async setOnline() {
    return this.client.post('/api/drivers/me/online');
  }

  async setOffline() {
    return this.client.post('/api/drivers/me/offline');
  }

  async updateLocation(lat: number, lng: number) {
    return this.client.post('/api/drivers/me/location', { lat, lng });
  }

  // Rides
  async getAvailableRides(lat?: number, lng?: number, radius?: number) {
    const params: any = {};
    if (lat !== undefined) params.lat = lat;
    if (lng !== undefined) params.lng = lng;
    if (radius !== undefined) params.radius = radius;
    
    return this.client.get('/api/drivers/me/available-rides', { params });
  }

  async getAssignedRides() {
    return this.client.get('/api/drivers/me/rides/assigned');
  }

  async acceptRide(rideId: string) {
    return this.client.post(`/api/drivers/me/rides/${rideId}/accept`);
  }

  async getRide(rideId: string) {
    return this.client.get(`/api/rides/${rideId}`);
  }

  async startRide(rideId: string) {
    return this.client.post(`/api/rides/${rideId}/start`);
  }

  async pickupCustomer(rideId: string) {
    return this.client.post(`/api/rides/${rideId}/pickup`);
  }

  async completeRide(rideId: string) {
    return this.client.post(`/api/rides/${rideId}/complete`);
  }

  async cancelRide(rideId: string, reason?: string) {
    return this.client.post(`/api/rides/${rideId}/cancel`, { reason });
  }

  async getRideHistory(page = 1, limit = 20) {
    return this.client.get(`/api/rides/driver/history?page=${page}&limit=${limit}`);
  }

  async getActiveRide() {
    return this.client.get('/api/rides/driver/active');
  }
}
