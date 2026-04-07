jest.mock('../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue(null),
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

import apiClient from '../../src/api/client';
import {
  sendOtp,
  verifyOtp,
  driverLogin,
  logout,
  getMe,
  registerPushToken,
} from '../../src/api/auth';

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendOtp', () => {
  it('calls POST /api/v1/auth/send-otp with phone', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await sendOtp('+996555123456');
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/auth/send-otp', {
      phone: '+996555123456',
    });
  });
});

describe('verifyOtp', () => {
  it('calls POST /api/v1/auth/verify-otp with phone and code', async () => {
    const authResponse = {
      token: 'abc123',
      user: { id: 1, name: 'Test', phone: '+996555123456', role: 'client' },
    };
    mockedClient.post.mockResolvedValue({ data: authResponse });

    const result = await verifyOtp('+996555123456', '1234');

    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/auth/verify-otp', {
      phone: '+996555123456',
      code: '1234',
    });
    expect(result).toEqual(authResponse);
  });
});

describe('driverLogin', () => {
  it('calls POST /api/v1/auth/driver-login with phone and password', async () => {
    const authResponse = {
      token: 'driver-token',
      user: { id: 2, name: 'Driver', phone: '+996555000000', role: 'driver' },
    };
    mockedClient.post.mockResolvedValue({ data: authResponse });

    const result = await driverLogin('+996555000000', 'secret');

    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/auth/driver-login', {
      phone: '+996555000000',
      password: 'secret',
    });
    expect(result).toEqual(authResponse);
  });
});

describe('logout', () => {
  it('calls POST /api/v1/auth/logout', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await logout();
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/auth/logout');
  });
});

describe('getMe', () => {
  it('calls GET /api/v1/auth/me and returns user', async () => {
    const user = { id: 1, name: 'Test', phone: '+996555123456', role: 'client' };
    mockedClient.get.mockResolvedValue({ data: user });

    const result = await getMe();

    expect(mockedClient.get).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(result).toEqual(user);
  });
});

describe('registerPushToken', () => {
  it('calls PUT /api/v1/auth/push-token with expo_push_token', async () => {
    mockedClient.put.mockResolvedValue({ data: null });
    await registerPushToken('ExponentPushToken[xxx]');
    expect(mockedClient.put).toHaveBeenCalledWith('/api/v1/auth/push-token', {
      expo_push_token: 'ExponentPushToken[xxx]',
    });
  });
});
