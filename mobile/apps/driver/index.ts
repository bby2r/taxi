import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundEvents } from './src/lib/notifee';
// Side-effect import: defineTask() registers the driver-location
// background task. Must happen at module top-level so the OS can call
// the task body even when no React tree is mounted (after process
// resurrection or while the app is fully backgrounded).
import './src/lib/location-task';

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
