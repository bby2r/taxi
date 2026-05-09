import { useEffect, useState } from 'react';
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

export type PushStatus =
  | { kind: 'idle' }
  | { kind: 'success'; token: string }
  | { kind: 'permission-denied' }
  | { kind: 'no-module' }
  | { kind: 'fetch-failed'; error: string }
  | { kind: 'register-failed'; error: string };

let currentStatus: PushStatus = { kind: 'idle' };
const statusListeners: Array<(s: PushStatus) => void> = [];

function setStatus(next: PushStatus): void {
  currentStatus = next;
  statusListeners.forEach((l) => l(next));
}

export function usePushStatus(): PushStatus {
  const [snapshot, setSnapshot] = useState<PushStatus>(currentStatus);
  useEffect(() => {
    const listener = (next: PushStatus): void => setSnapshot(next);
    statusListeners.push(listener);
    return () => {
      const idx = statusListeners.indexOf(listener);
      if (idx >= 0) statusListeners.splice(idx, 1);
    };
  }, []);
  return snapshot;
}

async function configureAndroidChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(DRIVER_OFFER_CHANNEL, {
    name: 'Новые заказы',
    description: 'Уведомления о новых заказах для водителей',
    importance: Notifications.AndroidImportance.MAX,
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

export async function registerToken(): Promise<{ ok: boolean; reason?: string; token?: string }> {
  if (!Notifications) {
    setStatus({ kind: 'no-module' });
    return { ok: false, reason: 'no-module' };
  }
  await configureAndroidChannel();

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    setStatus({ kind: 'permission-denied' });
    return { ok: false, reason: 'permission-denied' };
  }

  let tokenString: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    tokenString = tokenData.data;
    // eslint-disable-next-line no-console
    console.log('[push] Expo token:', tokenString);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus({ kind: 'fetch-failed', error: msg });
    // eslint-disable-next-line no-console
    console.warn('[push] getExpoPushTokenAsync failed:', msg);
    return { ok: false, reason: 'fetch-failed' };
  }

  try {
    await registerPushToken(tokenString);
    setStatus({ kind: 'success', token: tokenString });
    return { ok: true, token: tokenString };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus({ kind: 'register-failed', error: msg });
    // eslint-disable-next-line no-console
    console.warn('[push] registerPushToken POST failed:', msg);
    return { ok: false, reason: 'register-failed' };
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

    appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void tryRegister();
      }
    });

    if (Notifications) {
      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as { type?: string } | undefined;
        if (data?.type === 'new_order' && user?.role === 'driver' && navigationRef.isReady()) {
          try {
            navigationRef.navigate('DriverApp' as never);
          } catch {
            // not ready
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
  }, [isAuthenticated, user?.role, refreshUser]);
}
