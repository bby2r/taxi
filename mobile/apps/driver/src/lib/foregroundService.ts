import { Platform } from 'react-native';

// Optional native module — only available on Android in builds that
// include notifee + expo-build-properties. Older APKs see a no-op.
type NotifeeModule = typeof import('@notifee/react-native').default;
type NotifeeNamespace = typeof import('@notifee/react-native');

let Notifee: NotifeeModule | null = null;
let NotifeeNs: NotifeeNamespace | null = null;

if (Platform.OS === 'android') {
  try {
    const mod: NotifeeNamespace = require('@notifee/react-native');
    Notifee = mod.default;
    NotifeeNs = mod;
  } catch {
    Notifee = null;
  }
}

const SHIFT_CHANNEL_ID = 'driver_shift_v1';
const SHIFT_NOTIFICATION_ID = 'driver_shift_persistent';

let serviceRegistered = false;
let serviceActive = false;

/**
 * Register the long-running task that backs the foreground service.
 * Notifee requires this call to happen ONCE at module-import time,
 * before the React tree mounts, so the OS can re-attach to the task
 * after a process restart. The task simply never resolves — its only
 * job is to exist long enough that Android counts the process as a
 * foreground service and won't kill it.
 *
 * We do this here as a side-effect of importing the module so callers
 * don't have to remember it. Safe on iOS / non-notifee builds — just
 * a no-op.
 */
function ensureRegistered(): void {
  if (serviceRegistered || !Notifee) return;
  serviceRegistered = true;
  try {
    Notifee.registerForegroundService(() => {
      // Returning a never-resolving promise keeps the service alive
      // until `stopForegroundService` is called from JS.
      return new Promise(() => {
        /* intentionally never resolves */
      });
    });
  } catch {
    // ignore — notifee may not be initialised yet
  }
}

ensureRegistered();

async function ensureShiftChannel(): Promise<void> {
  if (!Notifee || !NotifeeNs) return;
  await Notifee.createChannel({
    id: SHIFT_CHANNEL_ID,
    name: 'Смена водителя',
    description: 'Постоянное уведомление пока водитель на линии. Без звука.',
    importance: NotifeeNs.AndroidImportance.LOW,
    sound: undefined,
    vibration: false,
    visibility: NotifeeNs.AndroidVisibility.PUBLIC,
  });
}

/**
 * Start a sticky foreground notification + Android foreground service.
 * The process is kept alive by the OS so:
 *   - Pusher's WebSocket stays connected, so offer events arrive in
 *     real time even with the app swiped away or the screen locked.
 *   - When an offer arrives, `notifee.displayNotification` with
 *     `fullScreenAction` + `loopSound` can fire from JS — that's
 *     the Yandex Pro "incoming call" UX that needs a live process.
 *   - The driver can't accidentally close the app and miss orders.
 *
 * Returns true if the service started (or was already running),
 * false on iOS / older builds where this is a no-op.
 */
export async function startShiftForegroundService(): Promise<boolean> {
  if (!Notifee || !NotifeeNs || Platform.OS !== 'android') return false;
  if (serviceActive) return true;

  try {
    ensureRegistered();
    await ensureShiftChannel();
    await Notifee.displayNotification({
      id: SHIFT_NOTIFICATION_ID,
      title: 'Вы на линии',
      body: 'Готовы принимать заказы',
      android: {
        channelId: SHIFT_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        smallIcon: 'ic_launcher',
        color: '#FBBF24',
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });
    serviceActive = true;
    return true;
  } catch {
    return false;
  }
}

export async function stopShiftForegroundService(): Promise<void> {
  if (!Notifee || Platform.OS !== 'android') return;
  if (!serviceActive) return;
  try {
    await Notifee.stopForegroundService();
  } catch {
    // ignore
  }
  try {
    await Notifee.cancelNotification(SHIFT_NOTIFICATION_ID);
  } catch {
    // ignore
  }
  serviceActive = false;
}

export function isShiftServiceActive(): boolean {
  return serviceActive;
}
