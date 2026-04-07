import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../api/auth';
import { useAuth } from '../context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications(): void {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      await registerPushToken(tokenData.data);
    })();
  }, [isAuthenticated]);
}
