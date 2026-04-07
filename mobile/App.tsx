import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

function AppContent(): React.ReactNode {
  const { user } = useAuth();
  return (
    <>
      <StatusBar style={user?.role === 'driver' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App(): React.ReactNode {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
