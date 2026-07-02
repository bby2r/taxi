import { Platform } from 'react-native';

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

// Bump суффикс когда меняешь importance/sound/vibration канала —
// Android фиксирует эти параметры при первом createChannel и не
// обновляет для того же id.
// v3: понизили importance HIGH → DEFAULT (СМС-стиль без heads-up),
// убрали lights + агрессивную вибрацию — клиент просит «как смски».
export const CLIENT_ORDER_CHANNEL = 'client_order_events_v3';

// Success-case: channelPromise остаётся resolved навсегда, все следующие
// вызовы дешёвно возвращают уже resolved promise. Failure-case: сбрасываем
// в null, чтобы следующий вызов попытался снова.
let channelPromise: Promise<void> | null = null;

export async function ensureClientChannel(): Promise<void> {
  if (!Notifee || !NotifeeNs) return;
  if (channelPromise) return channelPromise;
  channelPromise = (async () => {
    try {
      await Notifee!.createChannel({
        id: CLIENT_ORDER_CHANNEL,
        name: 'События заказа',
        description: 'Водитель принял, прибыл, поездка началась/завершена',
        importance: NotifeeNs!.AndroidImportance.DEFAULT,
        sound: 'default',
        vibration: true,
        vibrationPattern: [0, 200],
        bypassDnd: false,
        visibility: NotifeeNs!.AndroidVisibility.PUBLIC,
        lights: false,
      });
    } catch {
      channelPromise = null;
      throw new Error('channel creation failed');
    }
  })();
  // Проглатываем reject наружу, чтобы displayClientNotification не падал —
  // при следующем вызове ensureClientChannel сам стартанёт новую попытку
  // (channelPromise уже сброшен в catch выше).
  return channelPromise.catch(() => undefined);
}

export async function requestNotificationPermission(): Promise<void> {
  if (!Notifee) return;
  try {
    await Notifee.requestPermission();
  } catch {
    // ignore
  }
}

export async function displayClientNotification(opts: {
  id?: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!Notifee || !NotifeeNs) return;
  // Гарантируем что канал создан ДО первого displayNotification. Раньше
  // ensureClientChannel был fire-and-forget при mount App'а, и первое
  // событие могло прилететь до того как канал успел зарегистрироваться —
  // Android silently отклонял displayNotification без канала.
  await ensureClientChannel();
  try {
    await Notifee.displayNotification({
      id: opts.id,
      title: opts.title,
      body: opts.body,
      android: {
        channelId: CLIENT_ORDER_CHANNEL,
        importance: NotifeeNs.AndroidImportance.DEFAULT,
        visibility: NotifeeNs.AndroidVisibility.PUBLIC,
        sound: 'default',
        vibrationPattern: [0, 200],
        smallIcon: 'ic_notification',
        color: '#14B8A6',
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
      ios: {
        sound: 'default',
        critical: false,
        // 'active' = обычное уведомление (звук СМС), не 'timeSensitive'
        // (которое пробивает Focus и звучит громче).
        interruptionLevel: 'active',
      },
    });
  } catch {
    // best-effort
  }
}
