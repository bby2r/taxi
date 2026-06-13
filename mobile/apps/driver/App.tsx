import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider, useIconFonts } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): React.ReactNode {
  const fontsReady = useIconFonts({
    feather: require('./assets/fonts/Feather.ttf'),
    ionicons: require('./assets/fonts/Ionicons.ttf'),
  });
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
