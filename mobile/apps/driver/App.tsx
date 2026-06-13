import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Font from 'expo-font';
import { AuthProvider } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): React.ReactNode {
  // С New Architecture (enabled) автоматическая регистрация шрифтов
  // из APK assets/fonts/ не работает — RN их видит, но fontFamily не
  // резолвит. Регистрируем явно через Font.loadAsync с require'ами
  // локальных ttf (Metro гарантированно резолвит asset-ID). На любую
  // ошибку — продолжаем без шрифтов, не блокируем рендер.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    Font.loadAsync({
      Feather: require('./assets/fonts/Feather.ttf'),
      Ionicons: require('./assets/fonts/Ionicons.ttf'),
    })
      .catch((e) => console.warn('[App] font load failed:', e))
      .finally(() => setFontsReady(true));
  }, []);
  if (!fontsReady) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider requiredRole="driver">
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
