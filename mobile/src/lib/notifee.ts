import { Platform } from 'react-native';

// Optional native module — only available after `npm install` + EAS Build.
// Old APKs (built before notifee landed in package.json) just see `null`
// and we fall back to expo-notifications channels + expo-audio loop.
type NotifeeModule = typeof import('@notifee/react-native').default;
type NotifeeNamespace = typeof import('@notifee/react-native');

let Notifee: NotifeeModule | null = null;
let NotifeeNs: NotifeeNamespace | null = null;
let loadError: string | null = null;

if (Platform.OS === 'android') {
  try {
    const mod: NotifeeNamespace = require('@notifee/react-native');
    Notifee = mod.default;
    NotifeeNs = mod;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    Notifee = null;
  }
}

export function isNotifeeAvailable(): boolean {
  return Notifee !== null && NotifeeNs !== null;
}

export function getNotifeeLoadError(): string | null {
  return loadError;
}

// Versioned channel id — Android caches channel attributes permanently
// after first creation. Bump this string whenever sound / vibration /
// audio attributes change so a fresh channel is created on existing devices.
export const NOTIFEE_OFFER_CHANNEL = 'driver_offers_notifee_v1';

/**
 * Create the high-priority offer channel. Idempotent — safe to call on
 * every app boot. Old expo-notifications channels are not touched here;
 * useNotifications.ts handles their cleanup separately.
 */
export async function ensureNotifeeChannel(): Promise<void> {
  if (!Notifee || !NotifeeNs) return;
  try {
    await Notifee.createChannel({
      id: NOTIFEE_OFFER_CHANNEL,
      name: 'Новые заказы',
      description: 'Срочные уведомления о новых заказах. Звучат даже на беззвучном режиме.',
      importance: NotifeeNs.AndroidImportance.HIGH,
      sound: 'order_arrived',
      vibration: true,
      vibrationPattern: [400, 250, 400, 250, 400],
      bypassDnd: true,
      visibility: NotifeeNs.AndroidVisibility.PUBLIC,
      lights: true,
      lightColor: '#FBBF24',
    });
  } catch {
    // best effort; fall back to expo-notifications channel
  }
}

interface OfferDisplayOptions {
  orderId: number;
  title: string;
  body: string;
  expiresInSeconds: number;
}

/**
 * Render the incoming-offer notification with the Yandex-style bells:
 *
 *   - loopSound: true  → the .wav repeats until the driver accepts /
 *     declines or the OS auto-cancels after `timeoutAfter` ms.
 *   - fullScreenAction → launches the app full-screen even when the phone
 *     is locked (requires USE_FULL_SCREEN_INTENT permission, declared in
 *     app.json). Falls back to a regular heads-up if the OS denies it.
 *   - category: CALL    → tells Android to treat this like an incoming
 *     call: bypass silent / DND, max visual prominence, ringing tone.
 *   - actions          → Принять / Отказаться directly in the shade
 *     (and on the lock screen via full-screen action).
 *
 * Returns the notifee notification id so the caller can dismiss it
 * the moment the driver leaves the offer phase.
 */
export async function displayOfferNotification(
  opts: OfferDisplayOptions,
): Promise<string | null> {
  if (!Notifee || !NotifeeNs) return null;
  try {
    const id = await Notifee.displayNotification({
      id: `offer_${opts.orderId}`,
      title: opts.title,
      body: opts.body,
      data: {
        type: 'new_order',
        order_id: String(opts.orderId),
      },
      android: {
        channelId: NOTIFEE_OFFER_CHANNEL,
        category: NotifeeNs.AndroidCategory.CALL,
        importance: NotifeeNs.AndroidImportance.HIGH,
        visibility: NotifeeNs.AndroidVisibility.PUBLIC,
        sound: 'order_arrived',
        loopSound: true,
        vibrationPattern: [400, 250, 400, 250, 400],
        lights: ['#FBBF24', 300, 300],
        // Bring the app to the foreground on lock-screen tap.
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Принять',
            pressAction: {
              id: 'accept',
              launchActivity: 'default',
            },
          },
          {
            title: 'Отказаться',
            pressAction: {
              id: 'decline',
              launchActivity: 'default',
            },
          },
        ],
        autoCancel: false,
        ongoing: false,
        // Stop the loop and dismiss after the offer window expires anyway.
        // 1.5× the driver-side 20-second countdown so the server timeout
        // (30 s intra / 45 s inter-district) has time to fire first.
        timeoutAfter: opts.expiresInSeconds * 1000,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function dismissOfferNotification(notificationId?: string | null): Promise<void> {
  if (!Notifee) return;
  try {
    if (notificationId) {
      await Notifee.cancelNotification(notificationId);
    } else {
      await Notifee.cancelDisplayedNotifications();
    }
  } catch {
    // ignore
  }
}

/**
 * Subscribe to notifee press / action events. Returns an unsubscribe fn.
 * The callback receives the actionId ('accept' | 'decline' | 'default')
 * and the order_id from data; useDriverOrder then queues it via
 * pendingNotificationAction so the existing flow takes over.
 */
type ForegroundEventCallback = (event: {
  actionId: string;
  orderId: number | null;
}) => void;

export function subscribeForegroundEvents(cb: ForegroundEventCallback): () => void {
  if (!Notifee || !NotifeeNs) return () => undefined;
  const sub = Notifee.onForegroundEvent(({ type, detail }) => {
    if (
      type !== NotifeeNs!.EventType.ACTION_PRESS &&
      type !== NotifeeNs!.EventType.PRESS
    ) {
      return;
    }
    const actionId = detail.pressAction?.id ?? 'default';
    const orderIdRaw = detail.notification?.data?.order_id;
    const orderId =
      typeof orderIdRaw === 'string'
        ? parseInt(orderIdRaw, 10)
        : typeof orderIdRaw === 'number'
          ? orderIdRaw
          : null;
    cb({ actionId, orderId: Number.isFinite(orderId) ? (orderId as number) : null });
  });
  return sub;
}

/**
 * Register the background event handler. Notifee requires this to be
 * called as early as possible (e.g. App index entry) so action presses
 * fire correctly when the app was killed and is brought up by the
 * notification.
 */
export function registerBackgroundEvents(): void {
  if (!Notifee || !NotifeeNs) return;
  Notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (
      type !== NotifeeNs!.EventType.ACTION_PRESS &&
      type !== NotifeeNs!.EventType.PRESS
    ) {
      return;
    }
    const actionId = detail.pressAction?.id ?? 'default';
    const orderIdRaw = detail.notification?.data?.order_id;
    const orderId =
      typeof orderIdRaw === 'string'
        ? parseInt(orderIdRaw, 10)
        : typeof orderIdRaw === 'number'
          ? orderIdRaw
          : null;
    if (
      orderId !== null &&
      Number.isFinite(orderId) &&
      (actionId === 'accept' || actionId === 'decline')
    ) {
      // Lazy-import to avoid pulling React state into the background task.
      const { setPendingDriverAction } = await import('../utils/pendingNotificationAction');
      setPendingDriverAction({ orderId: orderId as number, kind: actionId });
    }
  });
}
