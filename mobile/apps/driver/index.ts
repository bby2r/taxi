import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundEvents } from './src/lib/notifee';
import { registerBackgroundOfferTask } from './src/lib/backgroundOfferTask';

// Notifee requires its background event handler to be registered as
// early as possible — before any React component mounts — so the OS can
// dispatch action presses to it when the app was killed and is being
// brought up by the notification itself. Safe no-op on iOS or if the
// module isn't bundled.
registerBackgroundEvents();

// Background notification task — fires the SYSTEM_ALERT_WINDOW offer
// overlay when an FCM push lands while the driver is in another app.
// Without this, only the system tray notification shows and the driver
// has to open the app + navigate to home before they see the offer card.
registerBackgroundOfferTask();

registerRootComponent(App);
