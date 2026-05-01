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
    const refreshToken = store.getState().auth.refreshToken;
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
  (response) => response,
  async (error) => {
    // Suppress POI endpoint 404 errors (optional feature)
    if (error.response?.status === 404 && error.config?.url?.includes('/map/pois')) {
      return Promise.reject(error);
    }
    
    const originalRequest = error.config;

    // Token expired
    // Exclude pre-auth paths (OTP register/verify, forgot-password, reset-password)
    // — these legitimately return 401/422 and should NOT trigger token refresh
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
