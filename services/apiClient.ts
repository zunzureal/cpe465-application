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
/** แจ้งเตือนเมื่อเบอร์โทรซ้ำ (สร้าง/แก้ไขผู้ป่วย) */
export const DUPLICATE_PHONE_MESSAGE = 'เบอร์นี้ได้ทำการลงทะเบียนแล้ว';

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
      let userMessage = 'Unknown error';
      try {
        const parsed = errorText ? JSON.parse(errorText) : null;
        userMessage = parsed?.error || parsed?.message || errorText || response.statusText || 'Unknown error';
      } catch (e) {
        userMessage = errorText || response.statusText || 'Unknown error';
      }
      const url = response.url || `${API_BASE}${endpoint}`;
      console.error('[apiCall] request failed:', `HTTP ${response.status} at ${url}:`, userMessage);
      return {
        success: false,
        error: userMessage,
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

/** สถานะบน Dashboard แพทย์ */
export type DoctorPatientDashboardStatus =
  | 'ครบแล้ว'
  | 'แจ้งเตือน'
  | 'กำลังรักษา'
  | 'รอแผน';

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
  /** จาก API — ใช้คำนวณการ์ดสรุปและไฮไลต์รายชื่อ */
  status?: DoctorPatientDashboardStatus;
  alertReasons?: string[];
  alertLabels?: string[];
  sessionsCompletedToday?: number;
  sessionsTargetToday?: number;
  scheduledToday?: boolean;
  lastSessionAt?: string | null;
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
): Promise<ApiResponse<{ patient: DoctorPatient; existing?: boolean }>> {
  const payload = {
    hospitalNumber: body.hospitalNumber ?? body.hnCode ?? '',
    name: body.name,
    age: body.age,
    phoneNumber: body.phoneNumber,
    gender: body.gender,
  };
  return apiCall<{ patient: DoctorPatient; existing?: boolean }>('/api/patients', {
    method: 'POST',
    body: payload,
  }, authToken);
}

/**
 * Get a single patient (doctor only)
 */
export type DoctorPatientDetail = {
  id: number;
  name: string;
  hnCode: string;
  age?: number;
  phoneNumber?: string;
  gender?: string;
};

export async function getDoctorPatient(
  authToken: string,
  patientId: number
): Promise<ApiResponse<DoctorPatientDetail>> {
  const res = await apiCall<DoctorPatientDetail | { patient: DoctorPatientDetail }>(
    `/api/patients/${patientId}`,
    {},
    authToken
  );
  if (!res.success || !res.data) return res as ApiResponse<DoctorPatientDetail>;
  const raw = res.data as DoctorPatientDetail | { patient: DoctorPatientDetail };
  const detail = 'patient' in raw && raw.patient ? raw.patient : (raw as DoctorPatientDetail);
  return { success: true, data: detail };
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
): Promise<ApiResponse<{ id: number; gender?: string; name?: string; hnCode?: string; age?: number; phoneNumber?: string }>> {
  return apiCall<{ id: number; gender?: string; name?: string; hnCode?: string; age?: number; phoneNumber?: string }>(`/api/patients/${patientId}`, {
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
  /** API field names (preferred) */
  flexion?: number;
  extension?: number;
  speed?: number;
  duration?: number;
  warmUp?: boolean;
  /** Legacy / form aliases — mapped to API names in putPatientPreset */
  targetFlexion?: number;
  targetExtension?: number;
  speedLevel?: number;
  durationMinutes?: number;
  useWarmup?: boolean;
  targetForceN?: number | null;
  forceLevel?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  sessionsPerDay?: number;
  daysOfWeek?: number[];
}

function toPresetApiBody(body: PutPatientPresetPayload): Record<string, unknown> {
  return {
    flexion: body.flexion ?? body.targetFlexion,
    extension: body.extension ?? body.targetExtension,
    speed: body.speed ?? body.speedLevel,
    duration: body.duration ?? body.durationMinutes,
    warmUp: body.warmUp ?? body.useWarmup,
    forceLevel: body.forceLevel,
    targetForceN: body.targetForceN,
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    sessionsPerDay: body.sessionsPerDay,
    daysOfWeek: body.daysOfWeek ?? [],
  };
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
    body: toPresetApiBody(body),
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

/** 404 when patient has no ACTIVE plan yet — normal, not a failure */
function isNoActivePlanError(status: number, message: string): boolean {
  return (
    status === 404 &&
    (message.includes('No active plan') || message.includes('No active preset'))
  );
}

/**
 * Get the latest active treatment plan preset for a patient (no auth required for now).
 * Returns success with data: null when there is no ACTIVE plan (not an error).
 */
export async function getPatientPreset(
  patientId: number
): Promise<ApiResponse<TreatmentPlanResponse | null>> {
  try {
    const fullUrl = `${API_BASE}/api/presets/${patientId}`;
    const response = await fetch(fullUrl, {
      headers: { Accept: 'application/json' },
    });

    const bodyText = await response.text().catch(() => '');
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsed = null;
    }
    const userMessage = String(
      parsed?.error || parsed?.message || bodyText || response.statusText || 'Unknown error'
    );

    if (!response.ok) {
      if (isNoActivePlanError(response.status, userMessage)) {
        return { success: true, data: null };
      }
      console.error(
        '[apiCall] request failed:',
        `HTTP ${response.status} at ${fullUrl}:`,
        userMessage
      );
      return { success: false, error: userMessage };
    }

    if (parsed && parsed.plan === null) {
      return { success: true, data: null };
    }
    return { success: true, data: parsed as TreatmentPlanResponse };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: message };
  }
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
