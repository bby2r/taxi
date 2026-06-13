import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { AuthProvider, ClientColors } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';
import BrandIntro from './src/components/BrandIntro';

// Keep the native splash visible until BrandIntro has mounted and
// rendered at least one frame. Otherwise Expo auto-hides the splash
// as soon as the JS bundle is loaded, exposing the activity's default
// window background (grey/white flash) for ~300ms before RN paints.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App(): React.ReactNode {
  const [introVisible, setIntroVisible] = useState(true);
  // С New Architecture (enabled) автоматическая регистрация шрифтов
  // из APK assets/fonts/ не работает. Регистрируем явно через
  // Font.loadAsync — Metro резолвит локальный ttf в asset-ID.
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      Feather: require('./assets/fonts/Feather.ttf'),
      Ionicons: require('./assets/fonts/Ionicons.ttf'),
    })
      .catch((e) => console.warn('[App] font load failed:', e))
      .finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <View style={styles.root}>
      <AuthProvider requiredRole="client">
        <StatusBar style="dark" />
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
