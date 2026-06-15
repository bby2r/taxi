import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient, useAuth, ClientColors } from '@taxi/shared';

// Foreground handler — без него notification, пришедший пока приложение
// открыто, обрабатывается тихо (только событие в JS, без UI). Юзер ждёт
// шторку — banner + звук обязательны. Critical для «Водитель прибыл».
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Создание канала и запрос permission — синхронно на старте, до auth.
// Раньше делалось внутри registerForPushAsync (только когда user
// появлялся), из-за чего на свежеустановленном APK канал не создавался
// до первого ре-логина, и локальные notification с channelId
// «order-events» молча отбрасывались Android.
let setupPromise: Promise<void> | null = null;

async function ensurePushSetup(): Promise<void> {
  if (Platform.OS === 'android') {
    // Переопределяем DEFAULT канал с importance MAX. Когда мы шлём
    // local notification через scheduleNotificationAsync({trigger: null}),
    // оно идёт в default канал — без MAX-importance оно бы тихо лежало
    // в шейде, не пробивая шторку. Также создаём 'order-events' для
    // случаев когда хотим использовать этот канал явно.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Уведомления',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ClientColors.primary,
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
      bypassDnd: false,
    });
    await Notifications.setNotificationChannelAsync('order-events', {
      name: 'События заказа',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ClientColors.primary,
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
      bypassDnd: false,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    return null;
  }
}

export function usePushNotifications(): void {
  const { user } = useAuth();
  const lastTokenRef = useRef<string | null>(null);

  // Канал + permission создаём ОДИН раз на маунте приложения,
  // независимо от того залогинен юзер или нет. Локальные notification
  // через Pusher должны работать сразу после установки.
  useEffect(() => {
    if (!setupPromise) {
      setupPromise = ensurePushSetup().catch(() => undefined);
    }
  }, []);

  // Server-push токен регистрируем когда юзер залогинен. Не критично:
  // FCM нужен Firebase project, без него токен не доставит push, но
  // регистрация в БД не мешает локальным notification.
  useEffect(() => {
    if (!user) {
      return;
    }
    (async () => {
      await setupPromise;
      const token = await getPushToken();
      if (!token || token === lastTokenRef.current) {
        return;
      }
      try {
        await apiClient.put('/api/v1/auth/push-token', { expo_push_token: token });
        lastTokenRef.current = token;
      } catch {
        // Сервер не принял — не критично, in-app остаётся работать.
      }
    })();
  }, [user]);
}
