import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundEvents } from './src/lib/notifee';

// Notifee requires its background event handler to be registered as
// early as possible — before any React component mounts — so the OS can
// dispatch action presses to it when the app was killed and is being
// brought up by the notification itself. Safe no-op on iOS or if the
// module isn't bundled.
registerBackgroundEvents();

registerRootComponent(App);
