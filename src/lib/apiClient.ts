import axios, { AxiosInstance, AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { frontendEnv } from '@/config/env';
const API_BASE_URL = frontendEnv.apiBaseUrl;

const getCsrfTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('csrf_token='));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split('=').slice(1).join('='));
};

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: frontendEnv.apiTimeoutMs,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management - Now using httpOnly cookies instead of localStorage
const getAccessToken = (): string | null => {
  // Tokens are now stored in httpOnly cookies, not accessible to JavaScript
  // The browser will automatically send them with requests
  return null;
};

const getRefreshToken = (): string | null => {
  // Refresh token is also in httpOnly cookie
  return null;
};

const setTokens = (accessToken: string, refreshToken?: string): void => {
  // Tokens are now set by the backend as httpOnly cookies
  // No longer storing in localStorage for security
};

const clearTokens = (): void => {
  // Tokens are cleared by the backend when logging out
  // No longer clearing localStorage
};

// Request interceptor - Cookies are sent automatically, no need to add Authorization header
apiClient.interceptors.request.use(
  (config) => {
    // Ensure cookies are included in every request for auth flows
    config.withCredentials = true;
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        config.headers.set('X-CSRF-Token', csrfToken);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle token refresh with cookies
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (config: InternalAxiosRequestConfig) => void;
  reject: (error: AxiosError) => void;
}> = [];

const processQueue = (error: AxiosError | null, config: InternalAxiosRequestConfig | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (config) {
      prom.resolve(config);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isLoginOrRegisterRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    const isRefreshRequest = requestUrl.includes('/auth/refresh');
    const isLogoutRequest = requestUrl.includes('/auth/logout');

    // Handle 401 Unauthorized - attempt token refresh for protected endpoints only.
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginOrRegisterRequest && !isRefreshRequest && !isLogoutRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint - it will set new cookies
        await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true, // Ensure cookies are sent
        });

        processQueue(null, originalRequest);
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();
        // Call global logout callback to update AuthContext state
        globalLogoutCallback();
        processQueue(refreshError as AxiosError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401 && (isLoginOrRegisterRequest || isRefreshRequest || isLogoutRequest)) {
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// Global logout callback - set by AuthContext
let globalLogoutCallback: () => void = () => {};

export const setGlobalLogoutCallback = (callback: () => void) => {
  globalLogoutCallback = callback;
};

export {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
};
