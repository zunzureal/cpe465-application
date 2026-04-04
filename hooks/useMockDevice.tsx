/**
 * Mock Device Simulator – for testing UI flow without physical PT machine.
 * Use MockDeviceProvider at app root, then useMockDevice() in Settings / Active Session.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const DEFAULT_START_ANGLE = 15;
const TELEMETRY_INTERVAL_MS = 500;
const CONNECT_DELAY_MS = 2000;

type MockDeviceState = {
  connectionStatus: ConnectionStatus;
  currentAngle: number;
  connectDevice: () => void;
  disconnectDevice: () => void;
  startMockSession: (targetAngle: number, startAngle?: number) => () => void;
  isSessionRunning: boolean;
};

const MockDeviceContext = createContext<MockDeviceState | null>(null);

export function MockDeviceProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentAngle, setCurrentAngle] = useState(DEFAULT_START_ANGLE);
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const directionRef = useRef<1 | -1>(1);

  const connectDevice = useCallback(() => {
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('connected');
      setCurrentAngle(DEFAULT_START_ANGLE);
    }, CONNECT_DELAY_MS);
  }, []);

  const disconnectDevice = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsSessionRunning(false);
    }
    setConnectionStatus('disconnected');
    setCurrentAngle(DEFAULT_START_ANGLE);
  }, []);

  const startMockSession = useCallback(
    (targetAngle: number, startAngle: number = DEFAULT_START_ANGLE) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentAngle(startAngle);
      directionRef.current = 1;
      setIsSessionRunning(true);

      intervalRef.current = setInterval(() => {
        setCurrentAngle((prev) => {
          const dir = directionRef.current;
          let next = prev + dir;
          if (next >= targetAngle) {
            next = targetAngle;
            directionRef.current = -1;
          } else if (next <= startAngle) {
            next = startAngle;
            directionRef.current = 1;
          }
          return next;
        });
      }, TELEMETRY_INTERVAL_MS);

      const stopMockSession = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsSessionRunning(false);
      };

      return stopMockSession;
    },
    []
  );

  const value: MockDeviceState = {
    connectionStatus,
    currentAngle,
    connectDevice,
    disconnectDevice,
    startMockSession,
    isSessionRunning,
  };

  return (
    <MockDeviceContext.Provider value={value}>
      {children}
    </MockDeviceContext.Provider>
  );
}

export function useMockDevice(): MockDeviceState {
  const ctx = useContext(MockDeviceContext);
  if (!ctx) {
    throw new Error('useMockDevice must be used within MockDeviceProvider');
  }
  return ctx;
}

/** Optional: use when provider might not be mounted (returns null instead of throwing). */
export function useMockDeviceOptional(): MockDeviceState | null {
  return useContext(MockDeviceContext);
}

/**
 * Active Session integration snippet:
 *
 * const mock = useMockDeviceOptional();
 * const [stopMock, setStopMock] = useState<(() => void) | null>(null);
 *
 * // When session starts (e.g. handleStartSession):
 * if (mock?.connectionStatus === 'connected') {
 *   const stop = mock.startMockSession(targetFlexion, targetExtension ?? 0);
 *   setStopMock(() => stop);
 * }
 *
 * // When session ends or pauses: stopMock?.();
 *
 * // Display live angle: mock?.currentAngle
 */
