/**
 * Sends treatment commands to the local mock CPM server (mock-device.js).
 * Priority:
 * 1) EXPO_PUBLIC_MOCK_DEVICE_URL (e.g. .env — restart Metro after changes)
 * 2) Same host as the Metro bundler (expoConfig.hostUri) so a physical device hits your Mac/PC
 * 3) Android emulator → 10.0.2.2; iOS simulator → 127.0.0.1
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Host part of dev server, e.g. "192.168.1.5" from "192.168.1.5:8081". */
function metroBundlerHost(): string | null {
  const uri = Constants.expoConfig?.hostUri;
  if (!uri || typeof uri !== 'string') return null;
  const host = uri.split(':')[0]?.trim();
  return host || null;
}

function resolveMockDeviceBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_MOCK_DEVICE_URL;
  if (fromEnv?.length) {
    return stripTrailingSlash(fromEnv);
  }

  const packagerHost = metroBundlerHost();

  if (packagerHost && packagerHost !== 'localhost' && packagerHost !== '127.0.0.1') {
    return `http://${packagerHost}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://127.0.0.1:3000';
}

const MOCK_DEVICE_BASE = resolveMockDeviceBase();

async function postMock(path: string, body: Record<string, unknown>, label: string): Promise<void> {
  try {
    const res = await fetch(`${MOCK_DEVICE_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...body,
        clientTimestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.warn(`[deviceService] ${label} HTTP`, res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn(
      `[deviceService] ${label} failed — URL: ${MOCK_DEVICE_BASE}${path} — run \`npm run mock-device\` or set EXPO_PUBLIC_MOCK_DEVICE_URL`,
      e,
    );
  }
}

export type StartSessionParams = {
  angleFlexion: number;
  angleExtension: number;
  speed: number;
  forceN: number;
  durationMinutes: number;
  isManualMode: boolean;
};

export async function sendStartCommand(params: StartSessionParams): Promise<void> {
  await postMock('/api/start-session', { ...params }, 'sendStartCommand');
}

/** Live snapshot while the machine session is active (RUNNING / PAUSED). */
export type SessionLiveSnapshot = {
  sessionState: 'RUNNING' | 'PAUSED';
  timeLeftSeconds: number;
  angleFlexion: number;
  angleExtension: number;
  speed: number;
  forceN: number;
  isManualMode: boolean;
};

export async function sendSessionPause(snapshot: SessionLiveSnapshot): Promise<void> {
  await postMock('/api/session-pause', { ...snapshot, action: 'pause' }, 'sendSessionPause');
}

export async function sendSessionResume(snapshot: SessionLiveSnapshot): Promise<void> {
  await postMock('/api/session-resume', { ...snapshot, action: 'resume' }, 'sendSessionResume');
}

export async function sendSessionRestart(snapshot: SessionLiveSnapshot & { durationMinutes: number }): Promise<void> {
  await postMock(
    '/api/session-restart',
    { ...snapshot, action: 'restart', durationMinutes: snapshot.durationMinutes },
    'sendSessionRestart',
  );
}

/** User pressed “เสร็จสิ้นการฝึก” — normal end (not hardware panic). */
export type SessionCompletePayload = {
  timeLeftSeconds?: number;
  targetFlexion?: number;
  targetForceN?: number;
  targetExtension?: number;
  speed?: number;
  durationMinutes?: number;
  /** e.g. user_finished | timer_expired */
  kind?: string;
};

export async function sendSessionComplete(payload?: SessionCompletePayload): Promise<void> {
  await postMock(
    '/api/session-complete',
    { ...payload, kind: payload?.kind ?? 'user_finished' },
    'sendSessionComplete',
  );
}

/** Mid-session parameter changes (debounced from UI). */
export async function sendSessionParametersUpdate(snapshot: SessionLiveSnapshot): Promise<void> {
  await postMock('/api/session-params', { ...snapshot, action: 'parameters_update' }, 'sendSessionParametersUpdate');
}

export type EmergencyStopPayload = {
  timeLeftSeconds?: number;
  targetFlexion?: number;
  targetForceN?: number;
};

/** True emergency / panic — optional; hardware E-stop if you add a dedicated control. */
export async function sendEmergencyStop(payload?: EmergencyStopPayload): Promise<void> {
  await postMock('/api/emergency-stop', { ...payload }, 'sendEmergencyStop');
}
