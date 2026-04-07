jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/api/client', () => {
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

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue(null),
  saveToken: jest.fn().mockResolvedValue(undefined),
  saveUser: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { getMe } from '../../src/api/auth';
import { getToken } from '../../src/utils/storage';
import type { User } from '../../src/api/types';

const mockedGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockedGetToken = getToken as jest.MockedFunction<typeof getToken>;

const testUser: User = {
  id: 1,
  name: 'Test User',
  phone: '+996555123456',
  role: 'client',
};

function TestConsumer() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <Text testID="loading">Loading</Text>;
  }

  return (
    <>
      <Text testID="user">{user ? user.name : 'none'}</Text>
      <TouchableOpacity
        testID="login-btn"
        onPress={() => login('token-abc', testUser)}
      />
      <TouchableOpacity testID="logout-btn" onPress={() => logout()} />
    </>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetToken.mockResolvedValue(null);
  mockedGetMe.mockReset();
});

describe('AuthContext', () => {
  it('provides user after login', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('none');
    });

    fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('Test User');
    });
  });

  it('clears user after logout', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('none');
    });

    fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('Test User');
    });

    fireEvent.press(getByTestId('logout-btn'));

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('none');
    });
  });

  it('restores user from stored token on mount', async () => {
    mockedGetToken.mockResolvedValue('stored-token');
    mockedGetMe.mockResolvedValue(testUser);

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('Test User');
    });

    expect(mockedGetMe).toHaveBeenCalledTimes(1);
  });

  it('handles expired token gracefully (getMe throws, user stays null)', async () => {
    mockedGetToken.mockResolvedValue('expired-token');
    mockedGetMe.mockRejectedValue(new Error('Unauthorized'));

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('none');
    });
  });
});
