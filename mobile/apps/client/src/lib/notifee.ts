import { Platform } from 'react-native';

// Notifee — нативный нотификационный API, гораздо надёжнее expo-notifications
// на Android: не зависит от FCM-credentials для локальных уведомлений,
// поддерживает кастомные каналы с MAX importance/bypassDnd, корректно
// показывает heads-up даже когда приложение в foreground. Driver-app
// использует тот же подход — см. ../../driver/src/lib/notifee.ts.

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

export const CLIENT_ORDER_CHANNEL = 'client_order_events_v1';

let channelEnsured = false;

export async function ensureClientChannel(): Promise<void> {
  if (!Notifee || !NotifeeNs || channelEnsured) return;
  try {
    await Notifee.createChannel({
      id: CLIENT_ORDER_CHANNEL,
      name: 'События заказа',
      description: 'Водитель принял, прибыл, поездка завершена',
      importance: NotifeeNs.AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [0, 250, 250, 250],
      bypassDnd: false,
      visibility: NotifeeNs.AndroidVisibility.PUBLIC,
      lights: true,
      lightColor: '#14B8A6',
    });
    channelEnsured = true;
  } catch {
    // best-effort
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (!Notifee) return;
  try {
    await Notifee.requestPermission();
  } catch {
    // ignore
  }
}

/**
 * Показывает heads-up notification у клиента. Работает мгновенно в
 * foreground / background / recent kill, без серверного FCM. Триггерится
 * из useOrder.ts на Pusher-события (order.accepted / driver_arrived /
 * completed).
 */
export async function displayClientNotification(opts: {
  id?: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!Notifee || !NotifeeNs) return;
  try {
    await Notifee.displayNotification({
      id: opts.id,
      title: opts.title,
      body: opts.body,
      android: {
        channelId: CLIENT_ORDER_CHANNEL,
        importance: NotifeeNs.AndroidImportance.HIGH,
        visibility: NotifeeNs.AndroidVisibility.PUBLIC,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        smallIcon: 'ic_notification',
        color: '#14B8A6',
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  } catch {
    // best-effort — vibration/TTS уже сработали в caller'е
  }
}
