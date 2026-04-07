import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/auth';
import { useAuth } from '../context/AuthContext';

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function useNotifications(): void {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || !Notifications) return;

    (async () => {
      const { status } = await Notifications!.requestPermissionsAsync();
      if (status !== 'granted') return;

      const tokenData = await Notifications!.getExpoPushTokenAsync();
      await registerPushToken(tokenData.data);
    })();
  }, [isAuthenticated]);
}
