import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/client/HomeScreen';
import HistoryScreen from '../screens/client/HistoryScreen';
import ProfileScreen from '../screens/client/ProfileScreen';
import { ClientTabParamList } from './types';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

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
