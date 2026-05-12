/**
 * Remembers mock CPM Bluetooth pairing per patient across tabs and app relaunch.
 * Cleared when patient taps "จำลองอุปกรณ์หลุด" or via clearDevicePaired().
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/AuthContext';

function storageKey(patientId: string | null) {
  return `@cpe465_cpm_device_paired:${patientId ?? 'none'}`;
}

type DevicePairedState = {
  /** True after a successful mock pairing flow for the current patient. */
  isPaired: boolean;
  /** AsyncStorage read finished for current account (avoid skipping flow before load). */
  hydrated: boolean;
  markDevicePaired: () => Promise<void>;
  clearDevicePaired: () => Promise<void>;
};

const DevicePairedContext = createContext<DevicePairedState | null>(null);

export function DevicePairedProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [isPaired, setIsPaired] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const key = useMemo(
    () => storageKey(auth.role === 'patient' ? auth.identifier : null),
    [auth.role, auth.identifier]
  );

  useEffect(() => {
    if (auth.isLoading) return;

    if (!auth.isLoggedIn || auth.role !== 'patient' || !auth.identifier) {
      setIsPaired(false);
      setHydrated(true);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!cancelled) {
          setIsPaired(v === '1');
          setHydrated(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPaired(false);
          setHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.isLoading, auth.isLoggedIn, auth.role, auth.identifier, key]);

  const markDevicePaired = useCallback(async () => {
    if (auth.role !== 'patient' || !auth.identifier) return;
    setIsPaired(true);
    try {
      await AsyncStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  }, [auth.role, auth.identifier, key]);

  const clearDevicePaired = useCallback(async () => {
    setIsPaired(false);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  const value = useMemo<DevicePairedState>(
    () => ({
      isPaired,
      hydrated,
      markDevicePaired,
      clearDevicePaired,
    }),
    [isPaired, hydrated, markDevicePaired, clearDevicePaired]
  );

  return (
    <DevicePairedContext.Provider value={value}>{children}</DevicePairedContext.Provider>
  );
}

export function useDevicePaired(): DevicePairedState {
  const ctx = useContext(DevicePairedContext);
  if (!ctx) {
    throw new Error('useDevicePaired must be used within DevicePairedProvider');
  }
  return ctx;
}
