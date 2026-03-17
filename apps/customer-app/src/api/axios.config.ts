import axios from 'axios';
import { store } from '../store';
import { logout, updateTokens } from '../store/auth.slice';
import { AuthTokens } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<AuthTokens> | null = null;

export const refreshAuthSession = async (): Promise<AuthTokens> => {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((response) => {
        const tokens = response.data?.data?.tokens;
        if (!tokens?.accessToken || !tokens?.refreshToken) {
          throw new Error('Refresh payload missing tokens');
        }

        store.dispatch(updateTokens(tokens));
        return tokens as AuthTokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Request interceptor - Add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Suppress POI endpoint 404 errors (optional feature)
    if (error.response?.status === 404 && error.config?.url?.includes('/map/pois')) {
      return Promise.reject(error);
    }
    
    console.error('API ERROR:', error.response?.data || error.message);
    const originalRequest = error.config;

    // Token expired
    if (
      error.response?.status === 401
      && !originalRequest._retry
      && !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const tokens = await refreshAuthSession();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
