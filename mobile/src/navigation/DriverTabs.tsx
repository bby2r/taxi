import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/driver/HomeScreen';
import ProfileScreen from '../screens/driver/ProfileScreen';
import { DriverTabParamList } from './types';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

const Tab = createBottomTabNavigator<DriverTabParamList>();

export default function DriverTabs(): React.ReactNode {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: DriverColors.primary,
        tabBarInactiveTintColor: DriverColors.textMuted,
        tabBarStyle: {
          backgroundColor: DriverColors.background,
          borderTopColor: DriverColors.border,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          fontSize: 12,
        },
      }}
    >
      <Tab.Screen
        name="DriverHome"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: () => <TabIcon label="🚕" />,
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: () => <TabIcon label="👤" />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ label }: { label: string }): React.ReactNode {
  return <Text style={{ fontSize: 22 }}>{label}</Text>;
}
