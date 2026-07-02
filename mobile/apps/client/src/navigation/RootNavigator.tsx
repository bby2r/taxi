import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth, ClientColors, navigationRef } from '@taxi/shared';
import AuthStack from './AuthStack';
import ClientTabs from './ClientTabs';
import NameSetupScreen from '../screens/NameSetupScreen';
import { RootStackParamList } from './types';
import { useNotifications } from '../hooks/useNotifications';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.ReactNode {
  const { isLoading, isAuthenticated, user } = useAuth();
  useNotifications();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={ClientColors.primary} />
      </View>
    );
  }

  // Authenticated but no name yet → gate behind NameSetupScreen.
  // New clients are firstOrCreate'd server-side with name = '', so
  // without this gate the driver sees an empty "имя клиента" slot
  // on first ride. The setup screen calls refreshUser when done, which
  // re-renders this component and flips us into ClientTabs naturally.
  const needsName = isAuthenticated && !user?.name?.trim();

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : needsName ? (
          <Stack.Screen name="NameSetup" component={NameSetupScreen} />
        ) : (
          <Stack.Screen name="ClientApp" component={ClientTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ClientColors.background,
  },
});
