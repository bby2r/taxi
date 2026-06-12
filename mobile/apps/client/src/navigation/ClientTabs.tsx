import React from 'react';
import { Ionicons } from '@expo/vector-icons';
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
        // Активный — brand teal; неактивный — textSecondary (#475569,
        // контраст ~8:1) вместо textMuted (#6B7A8F, ~5.6:1). Muted на
        // тёплой белой подложке визуально «уплывал», тонкие outline-
        // иконки и 12px-лейблы было трудно различить.
        tabBarActiveTintColor: ClientColors.primary,
        tabBarInactiveTintColor: ClientColors.textSecondary,
        tabBarStyle: {
          backgroundColor: ClientColors.white,
          borderTopColor: ClientColors.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 22,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 12,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Intercity"
        component={IntercityScreen}
        options={{
          tabBarLabel: 'Межгород',
          tabBarIcon: ({ color }) => <Ionicons name="bus-outline" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'История',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
