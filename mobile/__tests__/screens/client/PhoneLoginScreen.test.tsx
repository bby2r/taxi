jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/api/client', () => {
  const mockClient = {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    defaults: { baseURL: '', headers: {} },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: mockClient,
    setOnUnauthorized: jest.fn(),
  };
});

jest.mock('../../../src/api/auth', () => ({
  sendOtp: jest.fn().mockResolvedValue(undefined),
  getMe: jest.fn().mockResolvedValue(null),
  logout: jest.fn().mockResolvedValue(undefined),
  verifyOtp: jest.fn(),
}));

jest.mock('../../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue(null),
  saveToken: jest.fn().mockResolvedValue(undefined),
  saveUser: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PhoneLoginScreen from '../../../src/screens/client/PhoneLoginScreen';
import { sendOtp } from '../../../src/api/auth';

const mockedSendOtp = sendOtp as jest.MockedFunction<typeof sendOtp>;

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  setOptions: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn().mockReturnValue(true),
  canGoBack: jest.fn().mockReturnValue(false),
  addListener: jest.fn().mockReturnValue(jest.fn()),
  removeListener: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  getId: jest.fn(),
} as any;

const mockRoute = {
  key: 'PhoneLogin',
  name: 'PhoneLogin' as const,
  params: undefined,
};

describe('PhoneLoginScreen', () => {
  it('renders phone input and button', () => {
    const { getByLabelText, getByText } = render(
      <PhoneLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByLabelText('Номер телефона')).toBeTruthy();
    expect(getByText('Получить код')).toBeTruthy();
  });

  it('button is disabled when phone < 9 digits', () => {
    const { getByText, getByLabelText } = render(
      <PhoneLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.changeText(getByLabelText('Номер телефона'), '55512');

    const button = getByText('Получить код').parent?.parent;
    // The ActionButton wraps in TouchableOpacity; check accessibilityState
    const buttonElement = getByLabelText('Получить код');
    expect(buttonElement.props.accessibilityState?.disabled).toBe(true);
  });

  it('button is enabled when phone is 9 digits', () => {
    const { getByLabelText } = render(
      <PhoneLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.changeText(getByLabelText('Номер телефона'), '555123456');

    const button = getByLabelText('Получить код');
    expect(button.props.accessibilityState?.disabled).toBe(false);
  });

  it('on press calls sendOtp with +996 prefix', async () => {
    mockedSendOtp.mockResolvedValue(undefined);
    const { getByLabelText } = render(
      <PhoneLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '555123456');
    fireEvent.press(getByLabelText('Получить код'));

    await waitFor(() => {
      expect(mockedSendOtp).toHaveBeenCalledWith('+996555123456');
    });
  });
});
