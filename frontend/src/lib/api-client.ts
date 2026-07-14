import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import type { AuthResponse } from "@/types";

export const ACCESS_TOKEN_KEY = "vaniai_access_token";
export const REFRESH_TOKEN_KEY = "vaniai_refresh_token";

const API_BASE_URL = "/api/v1";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/**
 * Single-flight refresh: the first 401 kicks off one refresh request; every
 * other 401 that arrives while it is in flight awaits the same promise, then
 * all queued requests retry once with the new access token.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }
  // Use a bare axios call so this request does not go through the 401
  // interceptor (which would recurse).
  const response = await axios.post<AuthResponse>(
    `${API_BASE_URL}/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { "Content-Type": "application/json" } },
  );
  setTokens(response.data.access_token, response.data.refresh_token);
  return response.data.access_token;
}

function isAuthPath(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/register")
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;

    if (
      status !== 401 ||
      !original ||
      original._retry ||
      isAuthPath(original.url ?? "")
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      original.headers.set("Authorization", `Bearer ${newToken}`);
      return await apiClient.request(original);
    } catch (refreshError) {
      clearTokens();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(
        refreshError instanceof Error ? refreshError : error,
      );
    }
  },
);
