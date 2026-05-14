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
// /auth/me is the canonical session-validity check on app launch, and
// /auth/push-token registers the FCM token right after login — both
// require a working Sanctum session and a 401 from either means the
// stored token has been invalidated (different backend DB, server
// reset, manual revocation). Other 401s (background polling, stale
// in-flight requests from a previous session) stay non-fatal so a
// transient blip doesn't bump a freshly-authenticated user back to
// the login screen.
const AUTH_VALIDATING_PATHS = [
  '/api/v1/auth/me',
  '/api/v1/auth/push-token',
];

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
