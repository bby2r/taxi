import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken, useAuth } from '@taxi/shared';

let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

// Совпадает с channelId, который backend будет присылать через
// ExpoPushService в поле 'channelId'. Bump суффикс, если меняешь
// importance/sound канала — Android фиксирует эти параметры при первом
// createChannel и не даёт обновить для того же id.
// v2: снизили importance HIGH → DEFAULT (СМС-стиль вместо heads-up),
// убрали bypassDnd и мигание LED — уведомление о поездке не должно
// биться как звонок, клиент просит «как смски».
const CLIENT_PUSH_CHANNEL = 'client_order_push_v2';
// Тот же EAS project, что и у driver — оба app'а живут под одним
// Expo-аккаунтом; Expo Push Service доставляет по token'у независимо
// от projectId, так что split pool не нужен.
const PROJECT_ID = '6a367005-44a7-40d0-a95a-ec0d133c661c';

if (Notifications && Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    // Пусть системная шторка показывает уведомление даже в foreground —
    // клиент открыл app, положил в карман, водитель нажал «Прибыл» —
    // должен услышать звук/вибрацию не заходя обратно в приложение.
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CLIENT_PUSH_CHANNEL, {
    name: 'События заказа',
    description: 'Водитель принял, прибыл, поездка началась/завершена, отмена.',
    // DEFAULT = обычная шторка + системный звук СМС, без heads-up
    // всплывающего сверху. Клиент попросил «как смски» — не громко,
    // не как звонок.
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    // Короткий «вжик», не длинная тревожная серия.
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: false,
    enableVibrate: true,
    showBadge: false,
    bypassDnd: false,
  });
}

async function registerToken(): Promise<void> {
  if (!Notifications) return;
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    // eslint-disable-next-line no-console
    console.log('[push/client] Expo token:', tokenData.data);
    await registerPushToken(tokenData.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[push/client] register failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Регистрирует expo push token сервером и настраивает Android-канал
 * со звуком. Без этого backend `sendToUser` возвращает false и push
 * никогда не долетает до клиента — экран статусов «висит» пока
 * пользователь сам не откроет app.
 *
 * Тап по уведомлению открывает app (обработчик Linking уже настроен
 * в expo-notifications по умолчанию — нет доп. кода).
 */
export function useNotifications(): void {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'client' || Platform.OS === 'web') return;
    if (!Notifications) return;
    void registerToken();
  }, [isAuthenticated, user?.role]);
}
