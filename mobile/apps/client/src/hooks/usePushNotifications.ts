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

async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    // Канал создаётся ДО запроса permission и до получения токена —
    // иначе Android ставит важность по умолчанию (silent на dnd),
    // и «Водитель прибыл» не пробивается через шторку.
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
  let status = existing;
  if (status !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }
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

  useEffect(() => {
    if (!user) {
      return;
    }
    (async () => {
      const token = await registerForPushAsync();
      if (!token || token === lastTokenRef.current) {
        return;
      }
      try {
        await apiClient.put('/api/v1/auth/push-token', { expo_push_token: token });
        lastTokenRef.current = token;
      } catch {
        // Сервер ответил ошибкой — не критично, fallback на Pusher
        // в-app остаётся работать.
      }
    })();
  }, [user]);
}
