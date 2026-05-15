import { Platform } from 'react-native';

// Background notification handler. Two surfaces fire here when an FCM
// offer push lands and the app is minimised or killed:
//
//   1. Notifee full-screen-intent notification — Yandex Pro / Bolt
//      Driver "incoming call" UX. Shows a ringing-style screen even on
//      the lock screen with Принять / Отказаться buttons. This is the
//      reliable path: works on every Android version we ship to and
//      doesn't depend on the SYSTEM_ALERT_WINDOW grant.
//
//   2. SYSTEM_ALERT_WINDOW bottom-sheet via OfferOverlay — only if the
//      driver granted "Display over other apps" AND the OS keeps our
//      process alive enough for the WindowManager view to outlive the
//      task. Best-effort, layered on top of Notifee.
//
// Without this task, only the system tray notification shows because
// JS isn't running to call either surface.

type ExpoNotifications = typeof import('expo-notifications');
type ExpoTaskManager = typeof import('expo-task-manager');
type OfferOverlayModule = typeof import('../../modules/offer-overlay/src');
type NotifeeLib = typeof import('./notifee');

let Notifications: ExpoNotifications | null = null;
let TaskManager: ExpoTaskManager | null = null;
let OfferOverlay: OfferOverlayModule | null = null;
let Notifee: NotifeeLib | null = null;

if (Platform.OS === 'android') {
  try {
    Notifications = require('expo-notifications');
  } catch {
    Notifications = null;
  }
  try {
    TaskManager = require('expo-task-manager');
  } catch {
    TaskManager = null;
  }
  try {
    OfferOverlay = require('../../modules/offer-overlay/src');
  } catch {
    OfferOverlay = null;
  }
  try {
    Notifee = require('./notifee');
  } catch {
    Notifee = null;
  }
}

const BACKGROUND_OFFER_TASK = 'background-offer-overlay-task';

interface OfferData {
  type?: string;
  order_id?: number | string;
  pickup_address?: string;
  price?: number | string;
  expires_in?: number | string;
}

function toNumber(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

let registered = false;

export function registerBackgroundOfferTask(): void {
  if (registered) return;
  // Notifee is the must-have surface; OfferOverlay is the bonus. We keep
  // running even if OfferOverlay isn't bundled.
  if (!Notifications || !TaskManager) return;
  registered = true;

  TaskManager.defineTask(BACKGROUND_OFFER_TASK, async ({ data, error }) => {
    if (error || !data) return;

    // expo-notifications wraps the payload as { notification: {...} } when
    // the OS hands it to the task, but on some Android FCM paths the data
    // sits directly on `data`. Handle both shapes.
    const notification = (data as { notification?: { data?: OfferData } }).notification;
    const payload: OfferData = notification?.data ?? (data as OfferData);

    if (payload?.type !== 'new_order') return;

    const orderId = toNumber(payload.order_id, NaN);
    if (!Number.isFinite(orderId)) return;

    const price = toNumber(payload.price, 0);
    const expires = toNumber(payload.expires_in, 0);
    const durationSeconds = expires > 0 ? expires : 20;

    const address =
      typeof payload.pickup_address === 'string' && payload.pickup_address.trim().length > 0
        ? payload.pickup_address
        : 'Геолокация клиента';

    const body = address ? `Подача: ${address} · ${price} сом` : `Новый заказ · ${price} сом`;

    // Notifee full-screen intent — Yandex Pro style ringing card, fires
    // reliably even when OfferOverlay can't (no permission, OS killed
    // the foreground service, etc.).
    if (Notifee) {
      try {
        await Notifee.ensureNotifeeChannel();
        await Notifee.displayOfferNotification({
          orderId,
          title: 'Новый заказ',
          body,
          expiresInSeconds: durationSeconds,
        });
      } catch {
        // best effort — system tray still has the original push
      }
    }

    // SYSTEM_ALERT_WINDOW overlay — best effort on top of Notifee.
    if (
      OfferOverlay &&
      OfferOverlay.isOfferOverlayAvailable() &&
      OfferOverlay.hasOverlayPermission()
    ) {
      try {
        OfferOverlay.showOfferOverlay({ orderId, address, price, durationSeconds });
      } catch {
        // ignore — Notifee already covers the user-visible path
      }
    }
  });

  // Wire the task into expo-notifications' background dispatch. Idempotent
  // on later mounts because expo dedupes by task name.
  Notifications.registerTaskAsync(BACKGROUND_OFFER_TASK).catch(() => {
    // ignore — happens if the OS revokes notification permission later
  });
}
