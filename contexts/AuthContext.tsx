/**
 * Auth state and persistence.
 *
 * Tracks both the user's role (patient | doctor) and patient/doctor-specific data.
 * For patients: stores phone, patientId (from DB), and name.
 * For doctors: stores username (email).
 * Persists in AsyncStorage so auth survives app relaunches.
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
import { lookupPatientByPhone, doctorLogin } from '@/services/apiClient';

const AUTH_PHONE_KEY = '@cpe465_auth_phone';
const AUTH_ROLE_KEY = '@cpe465_auth_role';
const AUTH_ID_KEY = '@cpe465_auth_id';
const AUTH_PATIENT_ID_KEY = '@cpe465_auth_patient_id';
const AUTH_PATIENT_NAME_KEY = '@cpe465_auth_patient_name';
const AUTH_TOKEN_KEY = '@cpe465_auth_token';
const AUTH_EMAIL_KEY = '@cpe465_auth_email';

export type Role = 'patient' | 'doctor';

type AuthState = {
  isLoggedIn: boolean;
  isLoading: boolean;
  role: Role | null;
  identifier: string | null; // phone (patient) or email (doctor)
  patientId: number | null; // Database patient ID (patients only)
  patientName: string | null; // Patient name from DB (patients only)
  authToken: string | null; // JWT token for doctor (doctors only)
  loginPatient: (phoneNumber: string) => Promise<void>;
  loginDoctor: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedRole, storedId, legacyPhone, storedPatientId, storedPatientName, storedToken, storedEmail] =
          await Promise.all([
            AsyncStorage.getItem(AUTH_ROLE_KEY),
            AsyncStorage.getItem(AUTH_ID_KEY),
            AsyncStorage.getItem(AUTH_PHONE_KEY),
            AsyncStorage.getItem(AUTH_PATIENT_ID_KEY),
            AsyncStorage.getItem(AUTH_PATIENT_NAME_KEY),
            AsyncStorage.getItem(AUTH_TOKEN_KEY),
            AsyncStorage.getItem(AUTH_EMAIL_KEY),
          ]);

        if (cancelled) return;

        if (storedRole === 'patient' || storedRole === 'doctor') {
          setRole(storedRole);
          setIdentifier(storedId ?? legacyPhone ?? storedEmail ?? null);
          setAuthToken(storedToken);
          if (storedRole === 'patient' && storedPatientId) {
            setPatientId(parseInt(storedPatientId, 10));
            setPatientName(storedPatientName);
          }
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
          setPatientId(null);
          setPatientName(null);
          setAuthToken(null);
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

    try {
      // Look up patient in database using phone number
      const response = await lookupPatientByPhone(phoneNumber);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Patient lookup failed');
      }

      const { patientId: dbPatientId, name } = response.data;

      await AsyncStorage.multiSet([
        [AUTH_ROLE_KEY, 'patient'],
        [AUTH_ID_KEY, cleaned],
        [AUTH_PHONE_KEY, cleaned],
        [AUTH_PATIENT_ID_KEY, String(dbPatientId)],
        [AUTH_PATIENT_NAME_KEY, name],
      ]);
      setRole('patient');
      setIdentifier(cleaned);
      setPatientId(dbPatientId);
      setPatientName(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      console.error('[AuthContext] Patient login error:', message);
      throw err;
    }
  }, []);

  const loginDoctor = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    try {
      // Call backend to authenticate
      const response = await doctorLogin(trimmedEmail, password);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Doctor login failed');
      }

      const { token } = response.data;

      await AsyncStorage.multiSet([
        [AUTH_ROLE_KEY, 'doctor'],
        [AUTH_ID_KEY, trimmedEmail],
        [AUTH_EMAIL_KEY, trimmedEmail],
        [AUTH_TOKEN_KEY, token],
      ]);
      await AsyncStorage.removeItem(AUTH_PHONE_KEY);
      await AsyncStorage.removeItem(AUTH_PATIENT_ID_KEY);
      await AsyncStorage.removeItem(AUTH_PATIENT_NAME_KEY);
      
      setRole('doctor');
      setIdentifier(trimmedEmail);
      setAuthToken(token);
      setPatientId(null);
      setPatientName(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      console.error('[AuthContext] Doctor login error:', message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([
      AUTH_ROLE_KEY,
      AUTH_ID_KEY,
      AUTH_PHONE_KEY,
      AUTH_PATIENT_ID_KEY,
      AUTH_PATIENT_NAME_KEY,
      AUTH_TOKEN_KEY,
      AUTH_EMAIL_KEY,
    ]);
    setRole(null);
    setIdentifier(null);
    setPatientId(null);
    setPatientName(null);
    setAuthToken(null);
  }, []);

  const value: AuthState = {
    isLoggedIn: role !== null,
    isLoading,
    role,
    identifier,
    patientId,
    patientName,
    authToken,
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
