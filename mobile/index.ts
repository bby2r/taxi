import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundEvents } from './src/lib/notifee';

// Notifee requires its background event handler to be registered as
// early as possible — before any React component mounts — so the OS can
// dispatch action presses to it when the app was killed and is being
// brought up by the notification itself. Safe no-op on iOS or if the
// module isn't bundled.
registerBackgroundEvents();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
