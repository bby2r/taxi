import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../api/types';
import { getMe, logout as apiLogout } from '../api/auth';
import { saveToken, saveUser, clearAuth, getToken } from '../utils/storage';
import { setOnUnauthorized } from '../api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
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
      if (storedToken) {
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          await clearAuth();
        }
      }
      setIsLoading(false);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout: logoutHandler,
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
