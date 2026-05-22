// Points at the live Render-hosted backend for both dev and production.
// EXPO_PUBLIC_API_URL in eas.json overrides this for build-time configs;
// this constant is the fallback when env is missing or read from JS bundle.
export const API_BASE_URL = __DEV__
  ? 'https://taxi-api-cy7a.onrender.com'
  : 'https://taxi-api-cy7a.onrender.com';

export const PUSHER_KEY = '0d48c79a3cabdd93025a';
export const PUSHER_CLUSTER = 'ap1';

export const ORDER_STATUSES = {
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const OTP_LENGTH = 4;
export const OTP_RESEND_DELAY_SECONDS = 60;

export const DEFAULT_MAP_REGION = {
  latitude: 42.87,
  longitude: 74.59,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};
