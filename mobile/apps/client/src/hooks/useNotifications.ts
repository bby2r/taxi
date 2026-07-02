import { useEffect } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { registerPushToken, useAuth } from '@taxi/shared';

let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const CLIENT_PUSH_CHANNEL = 'client_order_push_v2';
const PROJECT_ID = '6a367005-44a7-40d0-a95a-ec0d133c661c';

if (Notifications && Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
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
  const config: Parameters<typeof Notifications.setNotificationChannelAsync>[1] = {
    name: 'События заказа',
    description: 'Водитель принял, прибыл, поездка началась/завершена, отмена.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: false,
    enableVibrate: true,
    showBadge: false,
    bypassDnd: false,
  };
  await Notifications.setNotificationChannelAsync(CLIENT_PUSH_CHANNEL, config);
  await Notifications.setNotificationChannelAsync('default', config);
}

// Идемпотентно: token регистрируется один раз за mount + повторно при
// возврате в foreground если ещё не зарегистрирован (permission могла
// быть отклонена, потом пользователь разрешил через настройки).
let registeredTokenRef: string | null = null;
let permissionAlertShown = false;

async function registerToken(): Promise<void> {
  if (!Notifications) return;
  await ensureChannel();

  // Сначала проверяем текущий статус — если already granted, не показываем
  // диалог снова (Android бы всё равно проигнорировал). Если undetermined,
  // запрашиваем — тогда покажется системный dialog.
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    // eslint-disable-next-line no-console
    console.warn('[push/client] permission not granted:', permission.status);
    if (!permissionAlertShown) {
      permissionAlertShown = true;
      Alert.alert(
        'Уведомления отключены',
        'Разрешите уведомления в настройках, чтобы получать статус заказа: «Водитель едет», «Прибыл», «Поездка началась».',
        [
          { text: 'Позже', style: 'cancel' },
          { text: 'Настройки', onPress: () => Linking.openSettings() },
        ],
      );
    }
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    if (registeredTokenRef === tokenData.data) return;
    // eslint-disable-next-line no-console
    console.log('[push/client] Expo token:', tokenData.data);
    await registerPushToken(tokenData.data);
    registeredTokenRef = tokenData.data;
    // eslint-disable-next-line no-console
    console.log('[push/client] token registered on backend');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[push/client] register failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Регистрирует expo push token сервером и настраивает Android-канал
 * со звуком. Ретрай на foreground: если пользователь отклонил permission
 * и потом разрешил через настройки, следующий resume в app подтянет
 * token без ручного перезапуска.
 */
export function useNotifications(): void {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'client' || Platform.OS === 'web') return;
    if (!Notifications) return;
    void registerToken();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void registerToken();
    });
    return () => sub.remove();
  }, [isAuthenticated, user?.role]);
}
