import * as SecureStore from 'expo-secure-store';
import {
  getToken,
  saveToken,
  removeToken,
  getUser,
  saveUser,
  removeUser,
  clearAuth,
} from '../../src/utils/storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('storage - token operations', () => {
  it('saveToken stores value with correct key', async () => {
    await saveToken('my-token');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'my-token');
  });

  it('getToken retrieves value with correct key', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('my-token');
    const result = await getToken();
    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('auth_token');
    expect(result).toBe('my-token');
  });

  it('getToken returns null when no token stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    const result = await getToken();
    expect(result).toBeNull();
  });

  it('removeToken deletes value with correct key', async () => {
    await removeToken();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});

describe('storage - user operations', () => {
  it('saveUser stores JSON-serialized user', async () => {
    const user = { id: 1, name: 'Test', phone: '+1234', role: 'client' };
    await saveUser(user);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth_user',
      JSON.stringify(user)
    );
  });

  it('getUser retrieves value with correct key', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('{"id":1}');
    const result = await getUser();
    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('auth_user');
    expect(result).toBe('{"id":1}');
  });

  it('removeUser deletes value with correct key', async () => {
    await removeUser();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
  });
});

describe('storage - clearAuth', () => {
  it('removes both token and user', async () => {
    await clearAuth();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
  });
});
