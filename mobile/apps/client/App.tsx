import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, ClientColors } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';
import BrandIntro from './src/components/BrandIntro';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ensureClientChannel, requestNotificationPermission } from './src/lib/notifee';

// Keep the native splash visible until BrandIntro has mounted and
// rendered at least one frame. Otherwise Expo auto-hides the splash
// as soon as the JS bundle is loaded, exposing the activity's default
// window background (grey/white flash) for ~300ms before RN paints.
SplashScreen.preventAutoHideAsync().catch(() => {});

function PushGate(): React.ReactNode {
  // Регистрация push-токена после авторизации. Хук слушает useAuth.user
  // и при появлении юзера получает Expo push-токен → отправляет на бэк.
  // Backend уже шлёт «Водитель прибыл» через ExpoPushService.
  usePushNotifications();
  return null;
}

export default function App(): React.ReactNode {
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    // Notifee-канал + permission создаём на маунте до auth — чтобы
    // local heads-up «Водитель прибыл» сразу работали при первом заказе.
    ensureClientChannel().catch(() => undefined);
    requestNotificationPermission().catch(() => undefined);
  }, []);

  return (
    <View style={styles.root}>
      <AuthProvider requiredRole="client">
        <StatusBar style="dark" />
        <PushGate />
        <RootNavigator />
        {introVisible && <BrandIntro onFinish={() => setIntroVisible(false)} />}
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ClientColors.background,
  },
});
