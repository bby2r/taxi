import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../api/types';
import { getMe, logout as apiLogout } from '../api/auth';
import { saveToken, saveUser, clearAuth, getToken, getUser } from '../utils/storage';
import { setOnUnauthorized } from '../api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logoutHandler = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore - token may already be invalid
    }
    await clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Optimistic restore — if we have cached user data, surface it
      // immediately so the driver / client stays logged in across
      // app launches without the home screen flashing the login form.
      // The /auth/me round-trip happens in parallel for freshness.
      try {
        const cachedJson = await getUser();
        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as User;
          setUser(cached);
        }
      } catch {
        // bad JSON or storage hiccup — ignore, the network path below
        // will populate fresh
      }
      setIsLoading(false);

      try {
        const me = await getMe();
        await saveUser(me);
        setUser(me);
      } catch (err) {
        // Only clear auth on a confirmed 401 (token is actually invalid).
        // Network errors, 5xx, timeouts and Render cold-starts shouldn't
        // boot the user back to login — the cached session is good enough
        // until the next call succeeds.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          await clearAuth();
          setUser(null);
        }
      }
    })();
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      logoutHandler();
    });
  }, [logoutHandler]);

  const login = useCallback(async (token: string, userData: User) => {
    await saveToken(token);
    await saveUser(userData);
    setUser(userData);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    await saveUser(me);
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout: logoutHandler,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
