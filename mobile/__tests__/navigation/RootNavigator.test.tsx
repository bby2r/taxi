jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/hooks/useNotifications', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('../../src/navigation/AuthStack', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>AuthStack</Text>,
  };
});

jest.mock('../../src/navigation/ClientTabs', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>ClientTabs</Text>,
  };
});

jest.mock('../../src/navigation/DriverStack', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>DriverStack</Text>,
  };
});

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ component: Component }: { component: React.ComponentType }) => <Component />,
  }),
}));

import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';
import RootNavigator from '../../src/navigation/RootNavigator';
import { useAuth } from '../../src/context/AuthContext';

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RootNavigator', () => {
  it('shows loading spinner when auth state is loading', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
    });

    const { UNSAFE_getByType } = render(<RootNavigator />);

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows AuthStack when not authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText } = render(<RootNavigator />);

    expect(getByText('AuthStack')).toBeTruthy();
  });

  it('shows ClientTabs when authenticated as client', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 1, name: 'Client', phone: '+996555000000', role: 'client' },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText } = render(<RootNavigator />);

    expect(getByText('ClientTabs')).toBeTruthy();
  });

  it('shows DriverStack when authenticated as driver', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 2, name: 'Driver', phone: '+996555111111', role: 'driver' },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText('DriverStack')).toBeTruthy();
    expect(queryByText('ClientTabs')).toBeNull();
    expect(queryByText('AuthStack')).toBeNull();
  });
});
