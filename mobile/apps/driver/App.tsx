import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): React.ReactNode {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
