import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OtpVerifyScreen } from '@taxi/shared';
import DriverLoginScreen from '../screens/LoginScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack(): React.ReactNode {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    </Stack.Navigator>
  );
}
