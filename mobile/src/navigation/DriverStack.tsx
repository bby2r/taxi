import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverTabs from './DriverTabs';
import OrderActiveScreen from '../screens/driver/OrderActiveScreen';
import StatsScreen from '../screens/driver/StatsScreen';
import { DriverStackParamList } from './types';
import { DriverColors } from '../theme/colors';
import { DriverOrderProvider } from '../hooks/useDriverOrder';

const Stack = createNativeStackNavigator<DriverStackParamList>();

export default function DriverStack(): React.ReactNode {
  return (
    <DriverOrderProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: DriverColors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
        <Stack.Screen
          name="OrderActive"
          component={OrderActiveScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="Stats" component={StatsScreen} />
      </Stack.Navigator>
    </DriverOrderProvider>
  );
}
