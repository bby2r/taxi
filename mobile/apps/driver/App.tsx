import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { Feather, Ionicons } from '@expo/vector-icons';
import { AuthProvider } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): React.ReactNode {
  // Шрифты иконок в release APK без явной runtime-инициализации не
  // регистрировались (в WebView видны кружки кнопок без содержимого,
  // в таб-баре — только лейблы без иконок). useFonts гарантирует, что
  // ttf зарегистрированы до первого рендера VectorIcon.
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    ...Ionicons.font,
  });
  if (!fontsLoaded) {
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
