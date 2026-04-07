import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import AuthStack from './AuthStack';
import ClientTabs from './ClientTabs';
import { RootStackParamList } from './types';
import { ClientColors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.ReactNode {
  const { user, isLoading, isAuthenticated } = useAuth();

  useNotifications();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={ClientColors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : user?.role === 'driver' ? (
          <Stack.Screen name="DriverApp" component={DriverPlaceholder} />
        ) : (
          <Stack.Screen name="ClientApp" component={ClientTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function DriverPlaceholder(): React.ReactNode {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={ClientColors.primary} />
    </View>
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
