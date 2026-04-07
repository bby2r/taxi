jest.mock('../../src/screens/driver/HomeScreen', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>DriverHomeScreen</Text>,
  };
});

jest.mock('../../src/screens/driver/OrderActiveScreen', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>OrderActiveScreen</Text>,
  };
});

jest.mock('../../src/screens/driver/StatsScreen', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>StatsScreen</Text>,
  };
});

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

let mockScreenProps: Record<string, Record<string, unknown>> = {};

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({
      component: Component,
      name,
      options,
    }: {
      component: React.ComponentType;
      name: string;
      options?: Record<string, unknown>;
    }) => {
      mockScreenProps[name] = options ?? {};
      return <Component />;
    },
  }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import DriverStack from '../../src/navigation/DriverStack';

beforeEach(() => {
  mockScreenProps = {};
});

describe('DriverStack', () => {
  it('renders DriverHome as the initial screen', () => {
    const { getByText } = render(<DriverStack />);

    expect(getByText('DriverHomeScreen')).toBeTruthy();
  });

  it('renders Stats screen', () => {
    const { getByText } = render(<DriverStack />);

    expect(getByText('StatsScreen')).toBeTruthy();
  });

  it('renders OrderActive screen with gesture disabled', () => {
    const { getByText } = render(<DriverStack />);

    expect(getByText('OrderActiveScreen')).toBeTruthy();
    expect(mockScreenProps['OrderActive']).toEqual(
      expect.objectContaining({ gestureEnabled: false }),
    );
  });
});
