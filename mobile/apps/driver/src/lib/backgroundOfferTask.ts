import { Platform } from 'react-native';

// Background notification handler — this is the missing piece that makes
// the Yandex-style overlay actually fire when an offer arrives while
// the app is minimised or killed. Without it, only the system tray push
// shows up and the driver has to open the app, navigate to the home
// screen, and *then* see the offer card.
//
// Flow on incoming FCM:
//   1. Expo push API delivers to the device.
//   2. expo-notifications routes the data payload to the task below.
//   3. Task checks data.type === 'new_order'.
//   4. If overlay permission is granted, calls OfferOverlay native module
//      to draw the bottom sheet over whatever app the driver is using.
//
// The foreground service from foregroundService.ts keeps the JS process
// alive between offers, so the WindowManager view we add here survives
// past the brief task lifetime.

type ExpoNotifications = typeof import('expo-notifications');
type ExpoTaskManager = typeof import('expo-task-manager');
type OfferOverlayModule = typeof import('../../modules/offer-overlay/src');

let Notifications: ExpoNotifications | null = null;
let TaskManager: ExpoTaskManager | null = null;
let OfferOverlay: OfferOverlayModule | null = null;

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
}

const BACKGROUND_OFFER_TASK = 'background-offer-overlay-task';

interface OfferData {
  type?: string;
  order_id?: number | string;
  pickup_address?: string;
  price?: number | string;
  expires_in?: number | string;
}

let registered = false;

export function registerBackgroundOfferTask(): void {
  if (registered) return;
  if (!Notifications || !TaskManager || !OfferOverlay) return;
  registered = true;

  TaskManager.defineTask(BACKGROUND_OFFER_TASK, async ({ data, error }) => {
    if (error || !data) return;

    // expo-notifications wraps the payload as { notification: {...} } when
    // the OS hands it to the task, but on some Android FCM paths the data
    // sits directly on `data`. Handle both shapes.
    const notification = (data as { notification?: { data?: OfferData } }).notification;
    const payload: OfferData = notification?.data ?? (data as OfferData);

    if (payload?.type !== 'new_order') return;

    const orderIdRaw = payload.order_id;
    const orderId =
      typeof orderIdRaw === 'string' ? parseInt(orderIdRaw, 10) : orderIdRaw;
    if (typeof orderId !== 'number' || !Number.isFinite(orderId)) return;

    const priceRaw = payload.price;
    const price =
      typeof priceRaw === 'string' ? parseInt(priceRaw, 10) : (priceRaw ?? 0);

    const expiresRaw = payload.expires_in;
    const expires =
      typeof expiresRaw === 'string' ? parseInt(expiresRaw, 10) : expiresRaw;

    const address =
      typeof payload.pickup_address === 'string' && payload.pickup_address.trim().length > 0
        ? payload.pickup_address
        : 'Геолокация клиента';

    if (!OfferOverlay) return;
    if (!OfferOverlay.isOfferOverlayAvailable()) return;
    if (!OfferOverlay.hasOverlayPermission()) return;

    try {
      OfferOverlay.showOfferOverlay({
        orderId,
        address,
        price: typeof price === 'number' ? price : 0,
        durationSeconds: typeof expires === 'number' && expires > 0 ? expires : 20,
      });
    } catch {
      // overlay throw is non-fatal — the system tray notification still
      // shows so the driver isn't completely blind to the offer
    }
  });

  // Wire the task into expo-notifications' background dispatch. Idempotent
  // on later mounts because expo dedupes by task name.
  Notifications.registerTaskAsync(BACKGROUND_OFFER_TASK).catch(() => {
    // ignore — happens if the OS revokes notification permission later
  });
}
