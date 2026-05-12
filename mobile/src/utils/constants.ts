// Both branches point at the ngrok tunnel served by the dev laptop's
// `php artisan serve`. While the Render service is suspended this is
// the only working backend; the laptop must be running ngrok + the
// Laravel dev server for the APK to reach the API. Switch the
// production branch back to https://taxi-l1jn.onrender.com once the
// Render service is reactivated.
export const API_BASE_URL = __DEV__
  ? 'https://glottal-brigid-oversensibly.ngrok-free.dev'
  : 'https://glottal-brigid-oversensibly.ngrok-free.dev';

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
