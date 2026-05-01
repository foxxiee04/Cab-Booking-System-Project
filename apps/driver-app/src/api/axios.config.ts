import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { store } from '../store';
import { logout, updateTokens } from '../store/auth.slice';
import { AuthTokens } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

let refreshPromise: Promise<AuthTokens> | null = null;

export const refreshAuthSession = async (): Promise<AuthTokens> => {
  if (!refreshPromise) {
    const refreshToken = store.getState().auth.refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {
        refreshToken,
      })
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

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Read from Redux store (in-memory per tab), not localStorage (shared across tabs in same incognito window)
    const token = store.getState().auth.accessToken;
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
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Suppress POI endpoint 404 errors (optional feature)
    if (error.response?.status === 404 && error.config?.url?.includes('/map/pois')) {
      return Promise.reject(error);
    }
    
    console.error('API ERROR:', error.response?.data || error.message);
    const originalRequest = error.config;

    // If 401 and not already retried — but skip pre-auth OTP paths
    const isPreAuthPath = /\/auth\/(register|send-otp|verify-otp|forgot-password|reset-password|register-phone)/.test(
      originalRequest.url || ''
    );
    if (
      error.response?.status === 401
      && !originalRequest._retry
      && !originalRequest.url?.includes('/auth/refresh')
      && !isPreAuthPath
    ) {
      originalRequest._retry = true;

      try {
        const tokens = await refreshAuthSession();

        // Retry original request
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout
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
