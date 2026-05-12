import { useCallback, useEffect, useRef, useState } from 'react';

import { useDevicePaired } from '@/contexts/DevicePairedContext';

const SCAN_MS = 1500;
const CONNECT_MS = 1500;
const SUCCESS_HOLD_MS = 1000;

export type DeviceConnectionStatus = 'scanning' | 'found' | 'connecting' | 'success';

/**
 * Bluetooth-style pairing simulation: scan → tap device → connect → success → callback.
 * Caller renders `DeviceConnectionModal` and calls `selectDiscoveredDevice` when the user taps the device row.
 */
export function useMockDeviceConnection() {
  const { isPaired, hydrated, markDevicePaired } = useDevicePaired();

  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<DeviceConnectionStatus>('scanning');
  const onCompleteRef = useRef<(() => void) | null>(null);
  const statusRef = useRef<DeviceConnectionStatus>('scanning');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const dismiss = useCallback(() => {
    clearTimers();
    setVisible(false);
    setStatus('scanning');
    onCompleteRef.current = null;
  }, [clearTimers]);

  const startMockConnection = useCallback(
    (onComplete: () => void) => {
      if (hydrated && isPaired) {
        onComplete();
        return;
      }

      clearTimers();
      onCompleteRef.current = onComplete;
      setStatus('scanning');
      statusRef.current = 'scanning';
      setVisible(true);

      const tScan = setTimeout(() => {
        setStatus('found');
        statusRef.current = 'found';
      }, SCAN_MS);
      timersRef.current.push(tScan);
    },
    [clearTimers, hydrated, isPaired]
  );

  /** Call when user taps the discovered device (only active while status is `found`). */
  const selectDiscoveredDevice = useCallback(() => {
    if (statusRef.current !== 'found') return;
    clearTimers();

    setStatus('connecting');
    statusRef.current = 'connecting';

    const tConnect = setTimeout(() => {
      setStatus('success');
      statusRef.current = 'success';

      const tDone = setTimeout(() => {
        setVisible(false);
        setStatus('scanning');
        statusRef.current = 'scanning';
        const cb = onCompleteRef.current;
        onCompleteRef.current = null;
        void markDevicePaired();
        cb?.();
      }, SUCCESS_HOLD_MS);
      timersRef.current.push(tDone);
    }, CONNECT_MS);
    timersRef.current.push(tConnect);
  }, [clearTimers, markDevicePaired]);

  /** Backdrop / Android back allowed only while user can cancel (scanning or found). */
  const canDismiss = status === 'scanning' || status === 'found';

  return {
    visible,
    status,
    startMockConnection,
    selectDiscoveredDevice,
    dismiss,
    canDismiss,
  };
}
