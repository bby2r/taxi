export const API_BASE_URL = __DEV__
  ? 'http://192.168.0.114:8000'
  : 'https://taxi-l1jn.onrender.com';

export const PUSHER_KEY = 'your-pusher-key';
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

export const FIXED_PRICE = 80;
