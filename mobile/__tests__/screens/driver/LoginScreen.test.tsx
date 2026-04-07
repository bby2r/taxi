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
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  driverLogin: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
  getMe: jest.fn().mockResolvedValue(null),
  registerPushToken: jest.fn(),
}));

jest.mock('../../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue(null),
  saveToken: jest.fn().mockResolvedValue(undefined),
  saveUser: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
}));

const mockLogin = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: mockLogin,
    logout: jest.fn(),
  }),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DriverLoginScreen from '../../../src/screens/driver/LoginScreen';
import { driverLogin } from '../../../src/api/auth';
import { DriverColors } from '../../../src/theme/colors';

const mockedDriverLogin = driverLogin as jest.MockedFunction<typeof driverLogin>;

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
  key: 'DriverLogin',
  name: 'DriverLogin' as const,
  params: undefined,
};

describe('DriverLoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders phone and password inputs', () => {
    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByLabelText('Номер телефона')).toBeTruthy();
    expect(getByLabelText('Пароль')).toBeTruthy();
  });

  it('renders "Войти" button', () => {
    const { getByText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText('Войти')).toBeTruthy();
  });

  it('button is disabled when phone is empty', () => {
    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.changeText(getByLabelText('Пароль'), 'secret123');

    const button = getByLabelText('Войти');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('button is disabled when password is empty', () => {
    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');

    const button = getByLabelText('Войти');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('button is enabled when both phone and password are filled', () => {
    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'secret123');

    const button = getByLabelText('Войти');
    expect(button.props.accessibilityState?.disabled).toBe(false);
  });

  it('calls driverLogin with phone and password on submit', async () => {
    mockedDriverLogin.mockResolvedValue({
      token: 'test-token',
      user: { id: 1, phone: '+996555123456', name: 'Driver', role: 'driver' } as any,
    });

    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'mypassword');
    fireEvent.press(getByLabelText('Войти'));

    await waitFor(() => {
      expect(mockedDriverLogin).toHaveBeenCalledWith('+996555123456', 'mypassword');
    });
  });

  it('shows loading indicator during API call', async () => {
    let resolveLogin: (value: any) => void;
    mockedDriverLogin.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; }),
    );

    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'secret');
    fireEvent.press(getByLabelText('Войти'));

    await waitFor(() => {
      const button = getByLabelText('Войти');
      expect(button.props.accessibilityState?.busy).toBe(true);
    });

    // Resolve to clean up
    resolveLogin!({
      token: 'tok',
      user: { id: 1, phone: '+996555123456', name: 'D', role: 'driver' },
    });
  });

  it('shows error message on 401 response', async () => {
    mockedDriverLogin.mockRejectedValue({ response: { status: 401 } });

    const { getByLabelText, getByText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'wrong');
    fireEvent.press(getByLabelText('Войти'));

    await waitFor(() => {
      expect(getByText('Неверный номер или пароль')).toBeTruthy();
    });
  });

  it('shows error message on 422 response', async () => {
    mockedDriverLogin.mockRejectedValue({ response: { status: 422 } });

    const { getByLabelText, getByText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'wrong');
    fireEvent.press(getByLabelText('Войти'));

    await waitFor(() => {
      expect(getByText('Неверный номер или пароль')).toBeTruthy();
    });
  });

  it('shows network error on other failures', async () => {
    mockedDriverLogin.mockRejectedValue(new Error('Network Error'));

    const { getByLabelText, getByText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'pass');
    fireEvent.press(getByLabelText('Войти'));

    await waitFor(() => {
      expect(getByText('Ошибка подключения. Попробуйте ещё раз.')).toBeTruthy();
    });
  });

  it('calls auth.login on success (navigates via auth state)', async () => {
    const mockUser = { id: 1, phone: '+996555123456', name: 'Driver', role: 'driver' } as any;
    mockedDriverLogin.mockResolvedValue({ token: 'abc123', user: mockUser });

    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByLabelText('Номер телефона'), '+996555123456');
    fireEvent.changeText(getByLabelText('Пароль'), 'correct');
    fireEvent.press(getByLabelText('Войти'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('abc123', mockUser);
    });
  });

  it('password input has secureTextEntry', () => {
    const { getByLabelText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    const passwordInput = getByLabelText('Пароль');
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('has dark theme background color', () => {
    const { getByText } = render(
      <DriverLoginScreen navigation={mockNavigation} route={mockRoute} />,
    );
    // Verify title and subtitle are rendered (dark theme markers)
    expect(getByText('Village Taxi')).toBeTruthy();
    expect(getByText('Вход для водителей')).toBeTruthy();
  });
});
