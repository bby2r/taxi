import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const webStorage = {
  getItemAsync: async (key: string): Promise<string | null> =>
    localStorage.getItem(key),
  setItemAsync: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    localStorage.removeItem(key);
  },
};

const store = Platform.OS === 'web' ? webStorage : SecureStore;

export async function getToken(): Promise<string | null> {
  return store.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await store.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await store.deleteItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<string | null> {
  return store.getItemAsync(USER_KEY);
}

export async function saveUser(user: object): Promise<void> {
  await store.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function removeUser(): Promise<void> {
  await store.deleteItemAsync(USER_KEY);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([removeToken(), removeUser()]);
}
