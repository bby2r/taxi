import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Feather, Ionicons } from '@expo/vector-icons';
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
  // В release APK ttf-шрифты vector-icons не подтягивались автомати-
  // чески — в таб-баре пропадали иконки. useFonts гарантирует
  // регистрацию до первого рендера.
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
