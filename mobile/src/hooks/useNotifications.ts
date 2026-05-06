import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const DRIVER_OFFER_CHANNEL = 'driver_offers';

async function configureAndroidChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(DRIVER_OFFER_CHANNEL, {
    name: 'Новые заказы',
    description: 'Уведомления о новых заказах для водителей',
    importance: Notifications.AndroidImportance.MAX,
    // To use a branded sound: drop a .wav into mobile/assets/sounds/,
    // re-enable the `sounds` array in app.json's expo-notifications plugin,
    // and replace 'default' below with the file name (e.g. 'order_arrived').
    sound: 'default',
    vibrationPattern: [0, 400, 250, 400, 250, 400],
    lightColor: '#FBBF24',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    enableVibrate: true,
    showBadge: false,
  });
}

export function useNotifications(): void {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || !Notifications) return;

    let foregroundSub: ReturnType<typeof Notifications.addNotificationReceivedListener> | null = null;
    let responseSub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;

    (async () => {
      try {
        await configureAndroidChannel();

        const { status } = await Notifications!.requestPermissionsAsync();
        if (status !== 'granted') return;

        const tokenData = await Notifications!.getExpoPushTokenAsync({
          projectId: 'ca4f91d1-a8f4-488b-9c14-0eb60aa286b8',
        });
        await registerPushToken(tokenData.data);
      } catch {
        // Push notifications not available — ignore
      }
    })();

    if (Notifications) {
      // When the user taps a notification (typically from a locked /
      // backgrounded device), if it's a new-order push for a driver, route
      // them to the home screen so useDriverOrder can pick the offer up via
      // Pusher / polling and show the OrderOfferCard with its 10-second
      // countdown. Use the imperative navigationRef instead of useNavigation
      // here because this hook runs above the NavigationContainer.
      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as { type?: string } | undefined;
        if (data?.type === 'new_order' && user?.role === 'driver' && navigationRef.isReady()) {
          try {
            navigationRef.navigate('DriverApp' as never);
          } catch {
            // If not ready yet, useDriverOrder picks up via polling on next focus
          }
        }
      });

      foregroundSub = Notifications.addNotificationReceivedListener(() => {
        // No-op: handler config above already presents the banner + sound.
      });
    }

    return () => {
      foregroundSub?.remove();
      responseSub?.remove();
    };
  }, [isAuthenticated, user?.role]);
}
