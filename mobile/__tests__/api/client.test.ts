import { API_BASE_URL } from '../../src/utils/constants';

// Mock storage before importing client
jest.mock('../../src/utils/storage', () => ({
  getToken: jest.fn(),
}));

import apiClient, { setOnUnauthorized } from '../../src/api/client';
import { getToken } from '../../src/utils/storage';

const mockedGetToken = getToken as jest.MockedFunction<typeof getToken>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('apiClient instance', () => {
  it('has correct baseURL from constants', () => {
    expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
  });

  it('has JSON content-type headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    expect(apiClient.defaults.headers['Accept']).toBe('application/json');
  });

  it('has 15s timeout', () => {
    expect(apiClient.defaults.timeout).toBe(15000);
  });
});

describe('request interceptor', () => {
  it('injects Authorization header when token exists', async () => {
    mockedGetToken.mockResolvedValue('test-token-123');

    // Use interceptors.request handlers directly
    const requestInterceptor = (apiClient.interceptors.request as any).handlers[0];
    const config = {
      headers: {
        set: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        normalize: jest.fn(),
        concat: jest.fn(),
        toJSON: jest.fn(),
        Authorization: undefined as string | undefined,
      },
    };

    const result = await requestInterceptor.fulfilled(config);
    expect(result.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('does not inject Authorization header when no token', async () => {
    mockedGetToken.mockResolvedValue(null);

    const requestInterceptor = (apiClient.interceptors.request as any).handlers[0];
    const config = {
      headers: {
        set: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        normalize: jest.fn(),
        concat: jest.fn(),
        toJSON: jest.fn(),
        Authorization: undefined as string | undefined,
      },
    };

    const result = await requestInterceptor.fulfilled(config);
    expect(result.headers.Authorization).toBeUndefined();
  });
});

describe('response interceptor - 401 handling', () => {
  it('calls onUnauthorized callback on 401 response', () => {
    const callback = jest.fn();
    setOnUnauthorized(callback);

    const responseInterceptor = (apiClient.interceptors.response as any).handlers[0];
    const error = {
      response: { status: 401 },
    };

    // The rejected handler should call callback and reject
    expect(() => {
      // Response interceptor rejected returns Promise.reject, we need to handle async
    }).not.toThrow();

    responseInterceptor.rejected(error).catch(() => {
      // Expected rejection
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnauthorized on non-401 errors', () => {
    const callback = jest.fn();
    setOnUnauthorized(callback);

    const responseInterceptor = (apiClient.interceptors.response as any).handlers[0];
    const error = {
      response: { status: 403 },
    };

    responseInterceptor.rejected(error).catch(() => {
      // Expected rejection
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
