import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DriverColors, Typography, useAuth } from '@taxi/shared';
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
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      {showIntercity && (
        <Tab.Screen
          name="DriverIntercity"
          component={IntercityScreen}
          options={{
            tabBarLabel: 'Межгород',
            tabBarIcon: ({ color }) => <Ionicons name="bus-outline" size={24} color={color} />,
          }}
        />
      )}
      <Tab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
