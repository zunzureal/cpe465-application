/**
 * Centralized API client for CPE465 backend.
 * Handles all HTTP requests with proper error handling and configuration.
 */

import { Platform } from 'react-native';

// Priority:
// 1) EXPO_PUBLIC_API_BASE_URL (recommended; supports real device + any env)
// 2) Platform defaults for local development
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: object;
  headers?: Record<string, string>;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Generic fetch wrapper with error handling
 */
async function apiCall<T>(
  endpoint: string,
  options: FetchOptions = {},
  authToken?: string
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { ...defaultHeaders, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const errorData = errorText ? JSON.parse(errorText).error || errorText : 'Unknown error';
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorData}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      error: message,
    };
  }
}

// ─── DOCTOR ENDPOINTS ────────────────────────────────────────────────────

export interface DoctorLoginPayload {
  email: string;
  password: string;
}

export interface DoctorLoginResponse {
  token: string;
}

/**
 * Doctor login with email and password
 */
export async function doctorLogin(
  email: string,
  password: string
): Promise<ApiResponse<DoctorLoginResponse>> {
  return apiCall<DoctorLoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export interface DoctorPatient {
  id: number;
  name: string;
  hnCode: string;
  age: number;
  hospitalId: number;
  primaryDoctorId: number;
  createdAt: string;
}

export type PatientTodayStatus = 'normal' | 'alert_pain' | 'in_session' | 'no_session';

export interface PatientWithStatus extends DoctorPatient {
  lastSessionDate: string | null;
  todayStatus: PatientTodayStatus;
  todayPainLevel: number | null;
}

/**
 * Get all patients for the logged-in doctor
 */
export async function getDoctorPatients(
  authToken: string
): Promise<ApiResponse<{ patients: DoctorPatient[] }>> {
  return apiCall<{ patients: DoctorPatient[] }>('/api/patients', {}, authToken);
}

/**
 * Get all patients with enriched status fields (lastSessionDate, todayStatus, todayPainLevel).
 * Falls back to plain getDoctorPatients if the backend has not yet implemented the enriched fields,
 * mapping missing fields to safe defaults so the UI still renders.
 */
export async function getDoctorPatientsWithStatus(
  authToken: string
): Promise<ApiResponse<{ patients: PatientWithStatus[] }>> {
  const result = await apiCall<{ patients: PatientWithStatus[] }>('/api/patients', {}, authToken);
  if (!result.success || !result.data) return result;

  // Normalise: if the backend omits the new fields, apply safe defaults
  const patients: PatientWithStatus[] = result.data.patients.map((p) => ({
    ...p,
    lastSessionDate: p.lastSessionDate ?? null,
    todayStatus: p.todayStatus ?? ('no_session' as PatientTodayStatus),
    todayPainLevel: p.todayPainLevel ?? null,
  }));

  return { success: true, data: { patients } };
}

// ─── PRESET / PRESCRIPTION ENDPOINTS ─────────────────────────────────────

export interface PresetPayload {
  targetFlexion: number;
  targetExtension: number;
  speedLevel: number;
  durationMinutes: number;
  useWarmup: boolean;
  targetForceN?: number | null;
}

/**
 * Create a new prescription preset for a patient (archives any previous active preset).
 */
export async function createPreset(
  patientId: number,
  payload: PresetPayload,
  authToken: string
): Promise<ApiResponse<TreatmentPlanResponse>> {
  return apiCall<TreatmentPlanResponse>(
    `/api/presets/${patientId}`,
    { method: 'POST', body: payload },
    authToken
  );
}

/**
 * Update the currently active prescription preset for a patient in-place.
 */
export async function updatePreset(
  patientId: number,
  payload: PresetPayload,
  authToken: string
): Promise<ApiResponse<TreatmentPlanResponse>> {
  return apiCall<TreatmentPlanResponse>(
    `/api/presets/${patientId}`,
    { method: 'PUT', body: payload },
    authToken
  );
}

// ─── PATIENT ENDPOINTS ────────────────────────────────────────────────────

export interface PatientLookupResponse {
  patientId: number;
  name: string;
  hospitalId: number;
}

/**
 * Lookup patient by phone number (no auth required)
 */
export async function lookupPatientByPhone(
  phoneNumber: string
): Promise<ApiResponse<PatientLookupResponse>> {
  return apiCall<PatientLookupResponse>('/api/patients/lookup', {
    method: 'POST',
    body: { phoneNumber },
  });
}

export interface TodayStatsResponse {
  sessionsCompleted: number;
  totalSessionsTarget: number;
  totalMinutes: number;
  maxFlexion: number;
  targetFlexion: number;
}

/**
 * Get today's session statistics for a patient (no auth required)
 */
export async function getPatientTodayStats(
  patientId: number
): Promise<ApiResponse<TodayStatsResponse>> {
  return apiCall<TodayStatsResponse>(`/api/patients/${patientId}/today-stats`);
}

export interface TreatmentPlanResponse {
  id: number;
  targetFlexion: number;
  targetExtension: number;
  speedLevel: number;
  durationMinutes: number;
  useWarmup: boolean;
  targetForceN?: number | null;
  forceLevel?: number;
}

/**
 * Get the latest active treatment plan preset for a patient (no auth required for now)
 */
export async function getPatientPreset(
  patientId: number
): Promise<ApiResponse<TreatmentPlanResponse>> {
  return apiCall<TreatmentPlanResponse>(`/api/presets/${patientId}`);
}

// ─── SESSION ENDPOINTS ────────────────────────────────────────────────────

export interface SessionSubmitPayload {
  patientId: number;
  planId: number;
  actualMaxFlexion: number;
  durationCompleted: number;
  isCustomUsed?: boolean;
  painLevel?: number | null;
  actualForceUsed?: number | null;
  actualMaxForceN?: number | null;
  sessionDate?: string;
}

export interface SessionResponse {
  id: number;
  patientId: number;
  planId: number;
  actualMaxFlexion: number;
  durationCompleted: number;
  isCustomUsed: boolean;
  painLevel?: number | null;
  actualForceUsed?: number | null;
  actualMaxForceN?: number | null;
  sessionDate: string;
  plan?: {
    id: number;
    targetFlexion: number;
    targetExtension?: number;
    durationMinutes?: number;
    status?: string;
    createdAt?: string;
  };
}

/**
 * Submit a completed therapy session
 */
export async function submitSession(
  payload: SessionSubmitPayload
): Promise<ApiResponse<SessionResponse>> {
  return apiCall<SessionResponse>('/api/sessions', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Get all sessions for a patient
 */
export async function getPatientSessions(
  patientId: number,
  options?: { fromDate?: string; toDate?: string; limit?: number }
): Promise<ApiResponse<SessionResponse[]>> {
  let url = `/api/sessions/${patientId}`;
  const params = new URLSearchParams();
  if (options?.fromDate) params.append('fromDate', options.fromDate);
  if (options?.toDate) params.append('toDate', options.toDate);
  if (options?.limit) params.append('limit', String(options.limit));
  if (params.toString()) url += `?${params.toString()}`;

  return apiCall<SessionResponse[]>(url);
}

export interface SessionWithResult extends SessionResponse {
  targetMet: boolean;
}

export interface SessionHistoryResponse {
  sessions: SessionWithResult[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get a patient's session history as an authenticated doctor.
 * Wraps the existing /api/sessions/{patientId} endpoint with auth and pagination.
 * Falls back gracefully: if the backend returns a plain array (old behaviour),
 * it is normalised into the paginated shape.
 */
export async function getDoctorPatientSessions(
  patientId: number,
  authToken: string,
  options?: { fromDate?: string; toDate?: string; limit?: number; offset?: number }
): Promise<ApiResponse<SessionHistoryResponse>> {
  let url = `/api/sessions/${patientId}`;
  const params = new URLSearchParams();
  if (options?.fromDate) params.append('fromDate', options.fromDate);
  if (options?.toDate) params.append('toDate', options.toDate);
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  if (params.toString()) url += `?${params.toString()}`;

  // Try authenticated request first; fall back to unauthenticated if 401
  const result = await apiCall<SessionHistoryResponse | SessionResponse[]>(url, {}, authToken);
  if (!result.success) return { success: false, error: result.error };

  const raw = result.data;

  // Backend returns paginated object → use directly
  if (raw && !Array.isArray(raw) && 'sessions' in raw) {
    const typed = raw as SessionHistoryResponse;
    return { success: true, data: typed };
  }

  // Backend returns plain array (old behaviour) → normalise + compute targetMet client-side
  const arr = (Array.isArray(raw) ? raw : []) as SessionResponse[];
  const sessions: SessionWithResult[] = arr.map((s) => ({
    ...s,
    targetMet:
      s.plan != null &&
      s.actualMaxFlexion >= s.plan.targetFlexion &&
      s.durationCompleted >= (s.plan.durationMinutes ?? 0) * 0.8,
  }));

  return {
    success: true,
    data: { sessions, total: sessions.length, limit: options?.limit ?? 50, offset: options?.offset ?? 0 },
  };
}
