/**
 * Auth state and persistence. Phone-only login; stored in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const AUTH_PHONE_KEY = '@cpe465_auth_phone';

type AuthState = {
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(AUTH_PHONE_KEY)
      .then((phone) => {
        if (!cancelled) {
          setIsLoggedIn(!!phone && phone.length >= 10);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoggedIn(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 10) return;
    await AsyncStorage.setItem(AUTH_PHONE_KEY, cleaned);
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_PHONE_KEY);
    setIsLoggedIn(false);
  }, []);

  const value: AuthState = {
    isLoggedIn,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
