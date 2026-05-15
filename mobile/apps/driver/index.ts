import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundEvents } from './src/lib/notifee';

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
