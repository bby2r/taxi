// Production-installed APKs (eas build --profile preview / production) always
// hit the Render-hosted backend — it lives at https://taxi-l1jn.onrender.com
// and is up 24/7 regardless of whether the dev machine is on. The ngrok
// branch is only for local development where the driver app talks to a
// laptop-side `php artisan serve` via an ngrok tunnel. `__DEV__` is true
// when running through `expo start` / Metro, false in any EAS-built APK.
export const API_BASE_URL = __DEV__
  ? 'https://glottal-brigid-oversensibly.ngrok-free.dev'
  : 'https://taxi-l1jn.onrender.com';

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
