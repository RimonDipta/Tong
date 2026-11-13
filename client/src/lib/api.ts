import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "") || "http://localhost:5000";

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  withCredentials: true,
});

let accessToken: string | null = null;

let refreshPromise: Promise<string | null> | null = null;

let onSessionExpired: (() => void) | null = null;

let onTokenRefreshed: ((token: string) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setAuthHandlers(handlers: {
  onSessionExpired: () => void;
  onTokenRefreshed: (token: string) => void;
}) {
  onSessionExpired = handlers.onSessionExpired;
  onTokenRefreshed = handlers.onTokenRefreshed;
}

/*
 * Concurrent 401s share one refresh request.
 */
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${SERVER_URL}/api/auth/refresh`, null, { withCredentials: true })
      .then((response) => {
        const token = response.data.accessToken as string;

        setAccessToken(token);
        onTokenRefreshed?.(token);

        return token;
      })
      .catch(() => {
        setAccessToken(null);

        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const isAuthRoute = original?.url?.startsWith("/auth/");

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retried ||
      isAuthRoute
    ) {
      return Promise.reject(error);
    }

    original._retried = true;

    const token = await refreshAccessToken();

    if (!token) {
      onSessionExpired?.();

      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;

    return api(original);
  },
);

export function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;

    if (message) {
      return message;
    }

    if (!error.response) {
      return "Can't reach the server. Check your connection.";
    }
  }

  return fallback;
}

export default api;
