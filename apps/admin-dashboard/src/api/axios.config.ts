import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { store } from '../store';
import { logout, updateTokens } from '../store/auth.slice';
import { AuthTokens } from '../types';

import { normalizeGatewayApiBaseUrl } from '../utils/gateway-base-url';

const API_URL = normalizeGatewayApiBaseUrl(process.env.REACT_APP_API_URL);

export const API_BASE_URL = API_URL;

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<AuthTokens> | null = null;

export const refreshAuthSession = async (): Promise<AuthTokens> => {
  if (!refreshPromise) {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken })
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

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    console.error('API ERROR:', error.response?.data || error.message);
    const originalRequest = error.config;

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
