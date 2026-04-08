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
      try {
        const { status } = await Notifications!.requestPermissionsAsync();
        if (status !== 'granted') return;

        const tokenData = await Notifications!.getExpoPushTokenAsync({
          projectId: 'ca4f91d1-a8f4-488b-9c14-0eb60aa286b8',
        });
        await registerPushToken(tokenData.data);
      } catch {
        // Push notifications not available — ignore
      }
    })();
  }, [isAuthenticated]);
}
