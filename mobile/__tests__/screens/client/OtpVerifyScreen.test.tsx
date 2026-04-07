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
  verifyOtp: jest.fn().mockResolvedValue({ token: 'abc', user: { id: 1, name: 'T', phone: '+996555123456', role: 'client' } }),
  getMe: jest.fn().mockResolvedValue(null),
  logout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue(null),
  saveToken: jest.fn().mockResolvedValue(undefined),
  saveUser: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import OtpVerifyScreen from '../../../src/screens/client/OtpVerifyScreen';
import { AuthProvider } from '../../../src/context/AuthContext';
import { verifyOtp } from '../../../src/api/auth';

const mockedVerifyOtp = verifyOtp as jest.MockedFunction<typeof verifyOtp>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn().mockReturnValue(true),
  canGoBack: jest.fn().mockReturnValue(true),
  addListener: jest.fn().mockReturnValue(jest.fn()),
  removeListener: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  getId: jest.fn(),
} as any;

const mockRoute = {
  key: 'OtpVerify',
  name: 'OtpVerify' as const,
  params: { phone: '+996555123456' },
};

describe('OtpVerifyScreen', () => {
  it('renders 4 OTP input cells', () => {
    const { getAllByLabelText } = render(
      <AuthProvider>
        <OtpVerifyScreen navigation={mockNavigation} route={mockRoute} />
      </AuthProvider>,
    );
    const cells = getAllByLabelText(/Digit \d+ of 4/);
    expect(cells).toHaveLength(4);
  });

  it('shows phone number from route params', () => {
    const { getByText } = render(
      <AuthProvider>
        <OtpVerifyScreen navigation={mockNavigation} route={mockRoute} />
      </AuthProvider>,
    );
    expect(getByText(/\+996555123456/)).toBeTruthy();
  });

  it('calls verifyOtp when all 4 digits entered', async () => {
    mockedVerifyOtp.mockResolvedValue({
      token: 'abc',
      user: { id: 1, name: 'T', phone: '+996555123456', role: 'client' },
    });

    const { getAllByLabelText } = render(
      <AuthProvider>
        <OtpVerifyScreen navigation={mockNavigation} route={mockRoute} />
      </AuthProvider>,
    );

    const cells = getAllByLabelText(/Digit \d+ of 4/);
    fireEvent.changeText(cells[0], '1');
    fireEvent.changeText(cells[1], '2');
    fireEvent.changeText(cells[2], '3');
    fireEvent.changeText(cells[3], '4');

    await waitFor(() => {
      expect(mockedVerifyOtp).toHaveBeenCalledWith('+996555123456', '1234');
    });
  });

  it('resend timer counts down from 60', async () => {
    jest.useFakeTimers();

    const { getByText } = render(
      <AuthProvider>
        <OtpVerifyScreen navigation={mockNavigation} route={mockRoute} />
      </AuthProvider>,
    );

    // Initially shows 60
    await waitFor(() => {
      expect(getByText(/60 сек/)).toBeTruthy();
    });

    // Advance by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(getByText(/59 сек/)).toBeTruthy();
    });

    // Advance by another 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(getByText(/57 сек/)).toBeTruthy();
    });

    jest.useRealTimers();
  });
});
