import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { getToken } from '../utils/storage';

// 90s covers a Render free-tier cold start (typically 30–60 s after the
// service has been idle for 15 minutes). On warm hits real responses come
// back in 1–3 s, so this only matters for the very first request after a
// long pause.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback;
}

// Endpoints that, on 401, mean "this token is no longer valid; log out".
// Anything not in this list (push-token registration, balance polling,
// stale background hits from a previous session) is treated as a transient
// failure — the caller already gets a rejected promise, but we don't
// invalidate the whole session over it. Previously a single stray 401
// from a background helper could log a freshly-authenticated user back
// out to the login screen.
const AUTH_VALIDATING_PATHS = ['/api/v1/auth/me'];

function isSessionValidationCall(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_VALIDATING_PATHS.some((path) => url.includes(path));
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      onUnauthorized &&
      isSessionValidationCall(error.config?.url)
    ) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
