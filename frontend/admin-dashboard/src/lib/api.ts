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

  // Drivers
  async getAllDrivers(page = 1, limit = 50) {
    return this.client.get(`/api/drivers?page=${page}&limit=${limit}`);
  }

  async verifyDriver(driverId: string, verified: boolean) {
    return this.client.patch(`/api/drivers/${driverId}/verify`, { licenseVerified: verified });
  }

  // Rides
  async getAllRides(page = 1, limit = 50) {
    return this.client.get(`/api/rides/available?page=${page}&limit=${limit}`);
  }

  async getRide(rideId: string) {
    return this.client.get(`/api/rides/${rideId}`);
  }

  // Users
  async getAllUsers(page = 1, limit = 50, role?: string) {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (role) params.append('role', role);
    return this.client.get(`/api/auth/admin/users?${params}`);
  }

  async updateUserStatus(userId: string, status: string) {
    return this.client.patch(`/api/auth/admin/users/${userId}/status`, { status });
  }

  // Stats
  async getStats() {
    // Mock for now - you can create dedicated admin endpoints
    return {
      data: {
        data: {
          totalRides: 0,
          totalDrivers: 0,
          totalCustomers: 0,
          revenue: 0,
        },
      },
    };
  }
}
