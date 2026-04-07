jest.mock('../../src/screens/client/PhoneLoginScreen', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>PhoneLoginScreen</Text>,
  };
});

jest.mock('../../src/screens/client/OtpVerifyScreen', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text>OtpVerifyScreen</Text>,
  };
});

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ component: Component, name }: { component: React.ComponentType; name: string }) => (
      <Component />
    ),
  }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import AuthStack from '../../src/navigation/AuthStack';

describe('AuthStack', () => {
  it('renders PhoneLogin as the initial screen', () => {
    const { getByText } = render(<AuthStack />);

    expect(getByText('PhoneLoginScreen')).toBeTruthy();
  });
});
