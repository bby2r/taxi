import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DriverColors, Typography, useAuth, Icon } from '@taxi/shared';
import HomeScreen from '../screens/HomeScreen';
import IntercityScreen from '../screens/IntercityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { DriverTabParamList } from './types';

const Tab = createBottomTabNavigator<DriverTabParamList>();

export default function DriverTabs(): React.ReactNode {
  const { user } = useAuth();
  const showIntercity = user?.accepts_intercity === true;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Активный — яркий brand-золотой; неактивный — светло-серый
        // textSecondary (#D1D5DB) вместо textMuted (#9CA3AF) — на тёмном
        // фоне таб-бара #1F2937 muted давал ~3.5:1 контраст, лейблы
        // буквально сливались. Secondary даёт ~10:1 — читается как надо.
        tabBarActiveTintColor: DriverColors.primary,
        tabBarInactiveTintColor: DriverColors.textSecondary,
        tabBarStyle: {
          backgroundColor: DriverColors.background,
          borderTopColor: DriverColors.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 22,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOpacity: 0.35,
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
        name="DriverHome"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: ({ color }) => <Icon name="home-outline" size={24} color={color} />,
        }}
      />
      {showIntercity && (
        <Tab.Screen
          name="DriverIntercity"
          component={IntercityScreen}
          options={{
            tabBarLabel: 'Межгород',
            tabBarIcon: ({ color }) => <Icon name="bus-outline" size={24} color={color} />,
          }}
        />
      )}
      <Tab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color }) => <Icon name="person-outline" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
