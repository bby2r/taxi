import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneLoginScreen from '../screens/client/PhoneLoginScreen';
import OtpVerifyScreen from '../screens/client/OtpVerifyScreen';
import DriverLoginScreen from '../screens/driver/LoginScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack(): React.ReactNode {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
    </Stack.Navigator>
  );
}
