import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { registerPushToken, useAuth, navigationRef } from '@taxi/shared';
import { setPendingDriverAction } from '../utils/pendingNotificationAction';
import { emitOverlayAction, isOverlayAction } from '../utils/overlayActionBus';

let Notifications: typeof import('expo-notifications') | null = null;
let moduleLoadError: string | null = null;

// Bump this whenever the channel config changes in a way that needs to take
// effect on existing devices (sound, vibration pattern, lights, audio
// attributes). Android permanently caches a channel's settings once it's
// been created — the only way to apply changes without an app reinstall
// is to give the channel a NEW id.
const DRIVER_OFFER_CHANNEL = 'driver_offers_v3';
// Тихий канал для non-offer уведомлений (отмена клиентом, завершение,
// сообщения от диспетчера). СМС-стиль: обычная шторка + системный звук
// уведомления, DEFAULT importance. Раньше все backend push уходили
// в driver_offers_v3 и водитель слышал громкий рингtone при отмене
// заказа — пользователь просит стандартный звук уведомления.
const DRIVER_EVENTS_CHANNEL = 'driver_events_v1';
const RIDE_OFFER_CATEGORY = 'ride_offer';
const PROJECT_ID = '6a367005-44a7-40d0-a95a-ec0d133c661c';

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');

    // Foreground policy: stay out of the OS shade entirely. OrderOfferCard +
    // the looping audio / vibration in useDriverOrder are the in-app surface.
    // Background pushes are unaffected — shouldShow* only applies while the
    // app is in front.
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });

    // Register the ride_offer category at module-load time (before the user
    // is even authenticated) so the very first server push to land on the
    // device already shows the Принять / Отказаться buttons. Doing this
    // inside the post-permission registerToken path was leaving the first
    // push button-less.
    Notifications!.setNotificationCategoryAsync(RIDE_OFFER_CATEGORY, [
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
    ]).catch(() => {
      // best effort — without this, the buttons just don't appear
    });

    // Sweep older channel ids so they don't linger in the user's
    // notification settings forever. Each version was created with stale
    // sound / audio-attribute defaults; this is the only way to retire
    // them without an app reinstall.
    if (Platform.OS === 'android') {
      ['driver_offers', 'driver_offers_v2'].forEach((id) => {
        Notifications!.deleteNotificationChannelAsync(id).catch(() => {
          // already gone or never created — fine
        });
      });
    }
  } catch (err) {
    moduleLoadError = err instanceof Error ? err.message : String(err);
    Notifications = null;
  }
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

  // Audio attributes pin the channel sound to the ALARM stream so it plays
  // even when the phone is on Silent / Vibrate mode and respects the alarm
  // volume slider (which users almost always keep loud). This is the
  // managed-Expo way of "ignore silent mode for new-order alerts" — no
  // native code required, no ringer-mode mutation needed. The phone stays
  // in whatever mode the driver set; the alarm stream just isn't subject
  // to the silent toggle.
  const audioAttributes = ((): unknown => {
    try {
      return {
        usage: (Notifications as unknown as { AndroidAudioUsage?: Record<string, number> })
          .AndroidAudioUsage?.ALARM,
        contentType: (
          Notifications as unknown as { AndroidAudioContentType?: Record<string, number> }
        ).AndroidAudioContentType?.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      };
    } catch {
      return undefined;
    }
  })();

  await Notifications.setNotificationChannelAsync(DRIVER_OFFER_CHANNEL, {
    name: 'Новые заказы',
    description: 'Срочные уведомления о новых заказах. Звучат даже на беззвучном режиме.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'order_arrived',
    vibrationPattern: [0, 400, 250, 400, 250, 400],
    lightColor: '#FBBF24',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    enableVibrate: true,
    showBadge: false,
    // Type cast — older expo-notifications type defs don't include
    // audioAttributes but the native side reads it.
    ...(audioAttributes ? { audioAttributes } : {}),
  } as Parameters<typeof Notifications.setNotificationChannelAsync>[1]);

  // Тихий канал для отмены / завершения / прочих информ. push'ей.
  const eventsConfig: Parameters<typeof Notifications.setNotificationChannelAsync>[1] = {
    name: 'События заказа',
    description: 'Отмена клиентом, завершение поездки, сообщения от диспетчера.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: false,
    enableVibrate: true,
    showBadge: false,
    bypassDnd: false,
  };
  await Notifications.setNotificationChannelAsync(DRIVER_EVENTS_CHANNEL, eventsConfig);
  // Fallback 'default' — как у клиента, пока backend не задеплоен.
  await Notifications.setNotificationChannelAsync('default', eventsConfig);
}

export async function registerToken(): Promise<{ ok: boolean; reason?: string; token?: string }> {
  if (!Notifications) {
    setStatus({ kind: 'no-module', error: moduleLoadError ?? undefined });
    return { ok: false, reason: 'no-module' };
  }
  setStatus({ kind: 'starting' });
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
    if (!isAuthenticated || Platform.OS === 'web') return;

    if (!Notifications) {
      setStatus({ kind: 'no-module', error: moduleLoadError ?? undefined });
      return;
    }

    let responseSub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;
    let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
    let permissionAlertShown = false;
    let registrationInFlight = false;

    const tryRegister = async (): Promise<void> => {
      // Don't fan out concurrent registration attempts when the user
      // background-foregrounds rapidly. The first one will succeed or fail;
      // the rest just wait.
      if (registrationInFlight) return;
      registrationInFlight = true;
      try {
        const result = await registerToken();
        if (result.ok) {
          try {
            await refreshUser();
          } catch {
            // banner refresh isn't critical
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
      } finally {
        registrationInFlight = false;
      }
    };

    void tryRegister();

    // Re-attempt registration whenever the driver foregrounds the app —
    // fixes the case where they enabled notifications in system settings
    // and came back. Cheap on the happy path because the token request is
    // a single POST and is already cached server-side after the first call.
    appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void tryRegister();
      }
    });

    const handleResponse = (
      response: import('expo-notifications').NotificationResponse,
    ): void => {
      const data = response.notification.request.content.data as
        | { type?: string; order_id?: number | string }
        | undefined;
      if (data?.type !== 'new_order' || user?.role !== 'driver') {
        return;
      }

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
          // not ready — useDriverOrder picks it up via Pusher / polling
        }
      }
    };

    responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Cold-start path: if the OS launched us straight from a notification
    // tap, the listener registered above never fires for that tap. Replay
    // the queued response so the action button still works after a
    // force-stop.
    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        if (last) {
          handleResponse(last);
        }
      })
      .catch(() => {
        // ignore
      });

    // OfferFirebaseMessagingService (the native FCM listener that owns
    // offer pushes) opens the app via aliftaxidriver://offer?action=...
    // &order_id=... — both notification action buttons and overlay button
    // taps route through that scheme. Parse here so the existing
    // pendingDriverAction queue stays the single source of truth.
    const handleDeepLink = (url: string | null): void => {
      if (!url) return;
      try {
        // aliftaxidriver://offer?action=accept&order_id=…
        // ─ push-уведомления incoming offer'а (accept/decline).
        if (url.startsWith('aliftaxidriver://offer')) {
          const parsed = new URL(url);
          const action = parsed.searchParams.get('action');
          const orderIdRaw = parsed.searchParams.get('order_id');
          const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : NaN;
          if (
            Number.isFinite(orderId) &&
            (action === 'accept' || action === 'decline')
          ) {
            setPendingDriverAction({ orderId, kind: action });
          }
          if (navigationRef.isReady()) {
            try {
              navigationRef.navigate('DriverApp' as never);
            } catch {
              // navigation may not be mounted yet — useDriverOrder polls
              // pendingDriverAction on mount anyway
            }
          }
          return;
        }

        // aliftaxidriver://active-order/<action>?order_id=…
        // ─ клики по прозрачной карточке активного заказа. Действия
        //   исполняются в OrderActiveScreen через overlayActionBus:
        //   у него на руках current phase (arrived/start/complete)
        //   и order info (phone, pickup coords).
        if (url.startsWith('aliftaxidriver://active-order')) {
          const parsed = new URL(url);
          const rawAction = parsed.pathname.replace(/^\/+/, '');
          const orderIdRaw = parsed.searchParams.get('order_id');
          const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : NaN;
          if (Number.isFinite(orderId) && isOverlayAction(rawAction)) {
            emitOverlayAction({ action: rawAction, orderId });
          }
          if (navigationRef.isReady()) {
            try {
              navigationRef.navigate('DriverApp' as never);
            } catch {
              // ignore — экран сам подпишется на bus при mount
            }
          }
        }
      } catch {
        // malformed URL — ignore
      }
    };

    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    void Linking.getInitialURL().then(handleDeepLink).catch(() => undefined);

    return () => {
      responseSub?.remove();
      appStateSub?.remove();
      linkingSub.remove();
    };
  }, [isAuthenticated, user?.role, refreshUser]);
}
