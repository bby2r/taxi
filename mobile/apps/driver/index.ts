import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundEvents } from './src/lib/notifee';

// Side-effect import: defineTask() registers the driver-location
// background task. Must happen at module top-level so the OS can call
// the task body even when no React tree is mounted (after process
// resurrection or while the app is fully backgrounded).
//
// Wrapped in try because in older builds expo-task-manager may not be
// bundled — a throw here would kill the entire JS bundle before React
// ever mounted, leaving the user staring at a grey screen with no
// login. With the try, the worst case is no background tracking; the
// JS interval in useDriverLocation still keeps the heartbeat alive.
try {
  require('./src/lib/location-task');
} catch (e) {
  console.warn('[index] driver-location task failed to register:', e);
}

// Notifee requires its background event handler to be registered as
// early as possible — before any React component mounts — so the OS can
// dispatch action presses to it when the app was killed and is being
// brought up by the notification itself. Safe no-op on iOS or if the
// module isn't bundled.
//
// Offer pushes themselves are handled in Kotlin by
// OfferFirebaseMessagingService — it shadows expo-notifications' FCM
// receiver, draws the SYSTEM_ALERT_WINDOW overlay + ringing notification
// directly, and routes Принять / Отказаться taps into the app via the
// aiyltaxidriver:// deep-link scheme.
registerBackgroundEvents();

registerRootComponent(App);
