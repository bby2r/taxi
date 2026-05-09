import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
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
const PROJECT_ID = 'ca4f91d1-a8f4-488b-9c14-0eb60aa286b8';

async function configureAndroidChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(DRIVER_OFFER_CHANNEL, {
    name: 'Новые заказы',
    description: 'Уведомления о новых заказах для водителей',
    importance: Notifications.AndroidImportance.MAX,
    // Switch from 'default' to your bundled file name (e.g. 'order_arrived')
    // once a .wav lands in mobile/assets/sounds/ and the `sounds` array is
    // re-enabled in app.json's expo-notifications plugin. The channel sound
    // is locked at first registration on each device — see the README.
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

async function registerToken(): Promise<{ ok: boolean; reason?: string; token?: string }> {
  if (!Notifications) {
    return { ok: false, reason: 'no-notifications-module' };
  }
  await configureAndroidChannel();

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return { ok: false, reason: 'permission-denied' };
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    // Surfaces in EAS / Metro device logs when diagnosing missing pushes.
    // eslint-disable-next-line no-console
    console.log('[push] Expo token:', tokenData.data);
    await registerPushToken(tokenData.data);
    return { ok: true, token: tokenData.data };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[push] registration failed:', err);
    return { ok: false, reason: 'token-fetch-or-server-failure' };
  }
}

export function useNotifications(): void {
  const { isAuthenticated, user, refreshUser } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || !Notifications) return;

    let foregroundSub: ReturnType<typeof Notifications.addNotificationReceivedListener> | null = null;
    let responseSub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;
    let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
    let permissionAlertShown = false;

    const tryRegister = async (): Promise<void> => {
      const result = await registerToken();
      if (result.ok) {
        // Pull a fresh /me so the auth context's `has_push_token` flag flips
        // and the banner in DriverHome can disappear without requiring a
        // re-login.
        try {
          await refreshUser();
        } catch {
          // ignore — banner refresh isn't critical
        }
        return;
      }
      if (result.reason === 'permission-denied' && !permissionAlertShown) {
        permissionAlertShown = true;
        Alert.alert(
          'Уведомления отключены',
          'Чтобы получать заказы когда приложение свернуто, разрешите уведомления в настройках телефона.',
        );
      }
    };

    void tryRegister();

    // Re-attempt registration whenever the user returns to the foreground —
    // fixes the case where they enabled notifications in system settings
    // and came back, but the existing session never re-registered the token.
    appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void tryRegister();
      }
    });

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
      appStateSub?.remove();
    };
  }, [isAuthenticated, user?.role]);
}
