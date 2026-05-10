import { useEffect, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { registerPushToken } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { setPendingDriverAction } from '../utils/pendingNotificationAction';

let Notifications: typeof import('expo-notifications') | null = null;
let moduleLoadError: string | null = null;

if (Platform.OS !== 'web') {
  try {
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
  } catch (err) {
    // Means the APK was built without the native side of expo-notifications.
    // OTA can't fix this — needs a fresh `eas build`. Surface it on the banner.
    moduleLoadError = err instanceof Error ? err.message : String(err);
    Notifications = null;
  }
}

const DRIVER_OFFER_CHANNEL = 'driver_offers';
const RIDE_OFFER_CATEGORY = 'ride_offer';
const PROJECT_ID = 'ca4f91d1-a8f4-488b-9c14-0eb60aa286b8';

async function configureRideOfferCategory(): Promise<void> {
  if (!Notifications) {
    return;
  }
  // Buttons that show up directly in the notification shade. Tapping them
  // queues a pending action (consumed by useDriverOrder when the offer
  // arrives in JS) and brings the app to foreground. iOS shows them via
  // long-press; Android renders them inline in the heads-up notification.
  await Notifications.setNotificationCategoryAsync(RIDE_OFFER_CATEGORY, [
    {
      identifier: 'accept',
      buttonTitle: 'Принять',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'decline',
      buttonTitle: 'Отказаться',
      options: { opensAppToForeground: true },
    },
  ]);
}

export type PushStatus =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'success'; token: string }
  | { kind: 'permission-denied' }
  | { kind: 'no-module'; error?: string }
  | { kind: 'fetch-failed'; error: string }
  | { kind: 'register-failed'; error: string };

let currentStatus: PushStatus = moduleLoadError
  ? { kind: 'no-module', error: moduleLoadError }
  : { kind: 'idle' };
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
    sound: 'order_arrived',
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
    setStatus({ kind: 'no-module', error: moduleLoadError ?? undefined });
    return { ok: false, reason: 'no-module' };
  }
  setStatus({ kind: 'starting' });
  await configureAndroidChannel();
  await configureRideOfferCategory();

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
    if (!isAuthenticated || Platform.OS === 'web') return;

    if (!Notifications) {
      // Make the failure visible on the home screen instead of staying
      // silently in `idle` — a common cause is an APK built without the
      // native side of `expo-notifications` (needs a fresh EAS build).
      setStatus({ kind: 'no-module', error: moduleLoadError ?? undefined });
      return;
    }

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
      const handleResponse = (response: import('expo-notifications').NotificationResponse): void => {
        const data = response.notification.request.content.data as
          | { type?: string; order_id?: number | string }
          | undefined;
        if (data?.type !== 'new_order' || user?.role !== 'driver') {
          return;
        }

        // Capture which action button (if any) the driver tapped. Default
        // tap (anywhere on the notification body) gives the platform's
        // "DEFAULT" identifier — fall back to opening the offer card.
        const actionId = response.actionIdentifier;
        const orderIdRaw = data.order_id;
        const orderId =
          typeof orderIdRaw === 'string' ? parseInt(orderIdRaw, 10) : orderIdRaw;

        if (
          orderId !== undefined &&
          Number.isFinite(orderId) &&
          (actionId === 'accept' || actionId === 'decline')
        ) {
          setPendingDriverAction({ orderId, kind: actionId });
        }

        if (navigationRef.isReady()) {
          try {
            navigationRef.navigate('DriverApp' as never);
          } catch {
            // not ready — useDriverOrder will pick it up via Pusher / polling
          }
        }
      };

      responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

      // Cold-start path: if the OS launched us straight from a notification
      // tap, the listener registered above never fires for that tap.
      // Replay the queued response so the action button still works after
      // a force-stop.
      Notifications.getLastNotificationResponseAsync()
        .then((last) => {
          if (last) {
            handleResponse(last);
          }
        })
        .catch(() => {
          // ignore
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
