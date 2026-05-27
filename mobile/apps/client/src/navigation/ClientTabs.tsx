import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClientColors, Typography } from '@taxi/shared';
import HomeScreen from '../screens/HomeScreen';
import IntercityScreen from '../screens/IntercityScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { ClientTabParamList } from './types';

const Tab = createBottomTabNavigator<ClientTabParamList>();

export default function ClientTabs(): React.ReactNode {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ClientColors.primary,
        tabBarInactiveTintColor: ClientColors.textMuted,
        tabBarStyle: {
          backgroundColor: ClientColors.white,
          borderTopColor: ClientColors.border,
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
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: () => <TabIcon label="🚕" />,
        }}
      />
      <Tab.Screen
        name="Intercity"
        component={IntercityScreen}
        options={{
          tabBarLabel: 'Межгород',
          tabBarIcon: () => <TabIcon label="🚌" />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'История',
          tabBarIcon: () => <TabIcon label="📋" />,
        }}
      />
      <Tab.Screen
        name="Profile"
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
