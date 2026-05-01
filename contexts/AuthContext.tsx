/**
 * Auth state and persistence.
 *
 * Tracks both the user's role (patient | doctor) and a per-role identifier
 * (patient phone number, or doctor username for the mock login). Persists in
 * AsyncStorage so role-based routing survives app relaunches.
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
const AUTH_ROLE_KEY = '@cpe465_auth_role';
const AUTH_ID_KEY = '@cpe465_auth_id';

export type Role = 'patient' | 'doctor';

type AuthState = {
  isLoggedIn: boolean;
  isLoading: boolean;
  role: Role | null;
  identifier: string | null;
  loginPatient: (phoneNumber: string) => Promise<void>;
  loginDoctor: (username: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [identifier, setIdentifier] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedRole, storedId, legacyPhone] = await Promise.all([
          AsyncStorage.getItem(AUTH_ROLE_KEY),
          AsyncStorage.getItem(AUTH_ID_KEY),
          AsyncStorage.getItem(AUTH_PHONE_KEY),
        ]);

        if (cancelled) return;

        if (storedRole === 'patient' || storedRole === 'doctor') {
          setRole(storedRole);
          setIdentifier(storedId ?? legacyPhone ?? null);
        } else if (legacyPhone && legacyPhone.length >= 10) {
          // Migrate older installs that only stored the patient phone.
          setRole('patient');
          setIdentifier(legacyPhone);
          await AsyncStorage.multiSet([
            [AUTH_ROLE_KEY, 'patient'],
            [AUTH_ID_KEY, legacyPhone],
          ]);
        }
      } catch {
        if (!cancelled) {
          setRole(null);
          setIdentifier(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginPatient = useCallback(async (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 10) return;
    await AsyncStorage.multiSet([
      [AUTH_ROLE_KEY, 'patient'],
      [AUTH_ID_KEY, cleaned],
      [AUTH_PHONE_KEY, cleaned],
    ]);
    setRole('patient');
    setIdentifier(cleaned);
  }, []);

  const loginDoctor = useCallback(async (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    await AsyncStorage.multiSet([
      [AUTH_ROLE_KEY, 'doctor'],
      [AUTH_ID_KEY, trimmed],
    ]);
    await AsyncStorage.removeItem(AUTH_PHONE_KEY);
    setRole('doctor');
    setIdentifier(trimmed);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_ROLE_KEY, AUTH_ID_KEY, AUTH_PHONE_KEY]);
    setRole(null);
    setIdentifier(null);
  }, []);

  const value: AuthState = {
    isLoggedIn: role !== null,
    isLoading,
    role,
    identifier,
    loginPatient,
    loginDoctor,
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
