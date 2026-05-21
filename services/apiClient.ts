/**
 * Centralized API client for CPE465 backend.
 * Handles all HTTP requests with proper error handling and configuration.
 * Backend: cpe465-server (Node.js/Express + Supabase)
 * Default port: 8080 (see backend/cpe465-server/.env)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLOUD_RUN_API_BASE = 'https://project-465-service-649507438534.asia-southeast1.run.app';

// Priority:
// 1) EXPO_PUBLIC_API_BASE_URL (recommended; set in .env.local for network access)
// 2) Cloud Run shared backend
// 3) Platform defaults for local development
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  CLOUD_RUN_API_BASE ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
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

  // If caller didn't pass a token, try to read from AsyncStorage (AuthContext persists it there)
  try {
    const AUTH_TOKEN_KEY = '@cpe465_auth_token';
    if (!authToken) {
      const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (stored) authToken = stored;
    }
  } catch (e) {
    // ignore storage read errors
  }

  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const fullUrl = `${API_BASE}${endpoint}`;
    console.error('[apiCall] fetch', method, fullUrl);
    // Debug: log headers (includes Authorization when authToken provided)
    console.error('[apiCall] headers', defaultHeaders);
    const response = await fetch(fullUrl, {
      method,
      headers: { ...defaultHeaders, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorData = 'Unknown error';
      try {
        errorData = errorText ? JSON.parse(errorText).error || errorText : 'Unknown error';
      } catch (e) {
        errorData = errorText || response.statusText || 'Unknown error';
      }
      const url = response.url || `${API_BASE}${endpoint}`;
      const errMsg = `HTTP ${response.status} ${response.statusText} at ${url}: ${errorData}`;
      console.error('[apiCall] request failed:', errMsg);
      return {
        success: false,
        error: errMsg,
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
  phoneNumber?: string;
  gender?: string;
  hospitalId: number;
  primaryDoctorId: number;
  createdAt: string;
}

/**
 * Get all patients for the logged-in doctor
 */
export async function getDoctorPatients(
  authToken: string
): Promise<ApiResponse<{ patients: DoctorPatient[] }>> {
  return apiCall<{ patients: DoctorPatient[] }>('/api/patients', {}, authToken);
}

export interface CreatePatientPayload {
  name: string;
  hospitalNumber?: string;
  hnCode?: string;
  phoneNumber?: string;
  age?: number;
  hospitalId?: number;
  gender?: string;
}

/**
 * Create a new patient (doctor only)
 */
export async function createPatient(
  authToken: string,
  body: CreatePatientPayload
): Promise<ApiResponse<{ patientId: number }>> {
  return apiCall<{ patientId: number }>('/api/patients', {
    method: 'POST',
    body,
  }, authToken);
}

/**
 * Get a single patient (doctor only)
 */
export async function getDoctorPatient(
  authToken: string,
  patientId: number
): Promise<ApiResponse<{ id: number; name: string; hnCode: string; age?: number; phoneNumber?: string; gender?: string }>> {
  return apiCall(`/api/patients/${patientId}`, {}, authToken);
}

export interface UpdatePatientPayload {
  name?: string;
  hnCode?: string;
  phoneNumber?: string;
  age?: number;
  gender?: string;
}

/**
 * Update patient info (doctor only)
 */
export async function updatePatient(
  authToken: string,
  patientId: number,
  body: UpdatePatientPayload
): Promise<ApiResponse<{ id: number }>> {
  try {
    const url = `${API_BASE}/api/patients/${patientId}`;
    console.error(`[api] PUT ${url} payload:`, body);
  } catch (e) {
    // ignore
  }
  return apiCall<{ id: number }>(`/api/patients/${patientId}`, {
    method: 'PUT',
    body,
  }, authToken);
}

/**
 * Deactivate (soft-delete) a treatment plan for a patient (doctor only).
 * Sets plan status to "inactive" — preserves the row and all session FK references.
 */
export async function deactivatePlan(
  authToken: string,
  patientId: number
): Promise<ApiResponse<TreatmentPlanResponse>> {
  return apiCall<TreatmentPlanResponse>(`/api/patients/${patientId}/preset/status`, {
    method: 'PATCH',
    body: { status: 'INACTIVE' },
  }, authToken);
}

/**
 * Delete treatment plan for a patient (doctor only)
 */
export async function deleteTreatmentPlan(
  authToken: string,
  patientId: number
): Promise<ApiResponse<{ success: boolean }>> {
  return apiCall<{ success: boolean }>(`/api/patients/${patientId}/plan`, {
    method: 'DELETE',
  }, authToken);
}

export interface PutPatientPresetPayload {
  targetFlexion: number;
  targetExtension?: number;
  speedLevel?: number;
  durationMinutes?: number;
  useWarmup?: boolean;
  targetForceN?: number | null;
  forceLevel?: number | null;
  // optional scheduling fields
  startDate?: string;
  endDate?: string;
  sessionsPerDay?: number;
  daysOfWeek?: number[]; // 0=Sunday..6=Saturday
}

/**
 * Update or create a treatment preset for a patient (doctor only)
 */
export async function putPatientPreset(
  authToken: string,
  patientId: number,
  body: PutPatientPresetPayload
): Promise<ApiResponse<TreatmentPlanResponse>> {
  return apiCall<TreatmentPlanResponse>(`/api/patients/${patientId}/preset`, {
    method: 'PUT',
    body,
  }, authToken);
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
  status?: string;
  startDate?: string;
  endDate?: string;
  sessionsPerDay?: number;
  daysOfWeek?: number[]; // 0=Sunday..6=Saturday
}

/**
 * Get the latest active treatment plan preset for a patient (no auth required for now)
 */
export async function getPatientPreset(
  patientId: number
): Promise<ApiResponse<TreatmentPlanResponse>> {
  return apiCall<TreatmentPlanResponse>(`/api/presets/${patientId}`);
}

// Delete patient (doctor only) — server may not implement this; call will return error if unavailable
export async function deletePatient(
  authToken: string,
  patientId: number
): Promise<ApiResponse<{}>> {
  try {
    const url = `${API_BASE}/api/patients/${patientId}`;
    console.error(`[api] DELETE ${url}`);
  } catch (e) {
    // ignore
  }
  return apiCall<{}>(`/api/patients/${patientId}`, { method: 'DELETE' }, authToken);
}

// ─── SESSION ENDPOINTS ────────────────────────────────────────────────────

export interface SessionSubmitPayload {
  patientId: number;
  planId?: number | null;
  actualMaxFlexion: number;
  durationCompleted: number;
  isCustomUsed?: boolean;
  painLevel?: number | null;
  actualForceUsed?: number | null;
  actualMaxForceN?: number | null;
  sessionDate?: string;
}

export interface PlanSummary {
  id: number;
  targetFlexion: number;
  targetExtension?: number;
  durationMinutes?: number;
  status?: string;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];
  sessionsPerDay?: number;
}

export interface SessionEntry {
  kind: 'session';
  id: number;
  patientId: number;
  planId?: number | null;
  actualMaxFlexion: number;
  durationCompleted: number;
  isCustomUsed: boolean;
  painLevel?: number | null;
  actualForceUsed?: number | null;
  actualMaxForceN?: number | null;
  sessionDate: string;
  status?: 'SUCCESS' | 'CONTINUE' | 'FAILED';
  sessionStatus?: 'SUCCESS' | 'CONTINUE' | 'FAILED';
  plan?: PlanSummary;
}

export interface MissedEntry {
  kind: 'missed';
  patientId: number;
  planId: number;
  sessionDate: string;
  plan?: PlanSummary;
  sessionStatus: 'MISSED';
  expectedSessions: number;
  completedSessions: number;
}

export type SessionResponse = SessionEntry | MissedEntry;

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

export interface SessionStartPayload {
  patientId: number;
  planId: number;
  isCustomUsed?: boolean;
  sessionDate?: string;
}

export async function startSession(
  payload: SessionStartPayload
): Promise<ApiResponse<SessionResponse>> {
  return apiCall<SessionResponse>('/api/sessions/start', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Delete the treatment plan for a patient (doctor only)
 */
export async function deletePatientPreset(
  authToken: string,
  patientId: number
): Promise<ApiResponse<void>> {
  return apiCall<void>(`/api/patients/${patientId}/preset`, {
    method: 'DELETE',
  }, authToken);
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
