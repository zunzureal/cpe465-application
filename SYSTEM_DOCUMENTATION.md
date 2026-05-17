# Smart Rehab — CPM Telemedicine System Documentation

> **Version:** 1.0 · **Last Updated:** 2025-05-17
> **Project:** CPE465 Smart Rehab Mobile Application

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [User Roles & Navigation Flow](#4-user-roles--navigation-flow)
5. [API Documentation](#5-api-documentation)
6. [Design System & State Management](#6-design-system--state-management)

---

## 1. Project Overview

**Smart Rehab** is a mobile telemedicine application built for CPM (Continuous Passive Motion) knee rehabilitation. The app bridges three entities:

- **Patient** — A patient recovering from knee surgery who performs prescribed CPM therapy sessions at home.
- **Doctor / Physical Therapist** — A clinician who monitors patient progress, issues prescriptions, and responds to pain alerts.
- **CPM Device** — A physical (or simulated) motorised machine that moves the patient's knee joint through a prescribed range of motion.

### Core Features

| Feature | Audience | Description |
|---------|----------|-------------|
| Phone-based login | Patient | Lookup by phone number, no password required |
| Treatment plan display | Patient | Shows target flexion, speed, duration, and force from the doctor's prescription |
| Therapy session control | Patient | Start, pause, resume, and complete a CPM session; relays parameters to the device in real time |
| Session history & progress | Patient | Weekly/monthly calendar view; ROM and pain level trends |
| Device pairing | Patient | Bluetooth-style connection to the CPM device (Wi-Fi/local network) |
| Patient overview dashboard | Doctor | Searchable list of assigned patients with real-time status badges |
| Prescription management | Doctor | Create or update CPM parameters (flexion, extension, speed, duration, warm-up, force) |
| Session history review | Doctor | Paginated list of every session per patient; Target vs. Achieved ROM; pain alerts |

---

## 2. Tech Stack

### Runtime & Framework

| Layer | Technology | Version |
|-------|-----------|---------|
| JavaScript runtime | React Native | 0.81.5 |
| React | React | 19.1.0 |
| Mobile framework | Expo SDK | Latest (managed workflow) |
| File-based routing | Expo Router | v5 |

### UI & Styling

| Library | Role |
|---------|------|
| **NativeWind** | Tailwind CSS for React Native (`className` prop support) |
| **Gluestack UI** | Optional component library (configured, minimal usage) |
| **React Native StyleSheet** | Primary styling method for all custom components |
| **Custom Design System** (`constants/design-system.ts`) | Centralised tokens — colours, typography, spacing, shadows, border radii |
| **`@expo/vector-icons` / Ionicons** | Icon set used across all screens |
| **react-native-svg** | SVG rendering for the `CircularTimer` component |
| **react-native-chart-kit** | Charting library (installed, reserved for progress charts) |
| **@legendapp/motion** | Declarative animations |
| **react-native-reanimated** | Low-level animation primitives |

### State & Data

| Library | Role |
|---------|------|
| **React Context API** | Global authentication state and device pairing state |
| **`@react-native-async-storage/async-storage`** | Persistent auth storage (role, token, patientId) |
| `fetch` (native) | HTTP client for all backend API calls |

### Developer Tools

| Tool | Purpose |
|------|---------|
| TypeScript (strict) | Type safety across the entire codebase |
| ESLint + Prettier | Linting and formatting |
| `expo-env.d.ts` | Typed environment variables (`EXPO_PUBLIC_*`) |

---

## 3. System Architecture

The mobile application communicates with two independent servers at runtime:

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                    │
│                                                         │
│  ┌─────────────┐   ┌───────────────┐   ┌────────────┐  │
│  │  AuthContext│   │ services/     │   │ services/  │  │
│  │  (JWT/phone)│   │ apiClient.ts  │   │ deviceSvc  │  │
│  └─────────────┘   └──────┬────────┘   └─────┬──────┘  │
└─────────────────────────────┼─────────────────┼─────────┘
                              │                 │
                    HTTP/REST │                 │ HTTP/REST
                    (port 8080)                 │ (port 3000)
                              │                 │
               ┌──────────────▼──┐   ┌──────────▼────────┐
               │  Backend API    │   │  Mock CPM Device  │
               │  (Go / Node /   │   │  Server (local    │
               │   Python, TBD)  │   │  network)         │
               └─────────────────┘   └───────────────────┘
                       │
               ┌───────▼────────┐
               │   Database     │
               │  (PostgreSQL / │
               │   MySQL, TBD)  │
               └────────────────┘
```

### Backend API Server (`EXPO_PUBLIC_API_BASE_URL`, default port 8080)

Handles all persistent business data: user authentication, patient records, treatment presets, and session history. Doctor requests are authenticated with JWT; patient requests use only the `patientId` integer.

**Platform fallbacks (local development):**

```
Android emulator → http://10.0.2.2:8080
iOS simulator / device → http://localhost:8080
```

### Mock CPM Device Server (`EXPO_PUBLIC_MOCK_DEVICE_URL`, default port 3000)

A lightweight local server that simulates the physical CPM machine on the same Wi-Fi network as the phone. The app sends session commands (start, pause, resume, update params, stop) as POST requests. This server is replaced by the real device firmware in production.

**Platform fallbacks:**

```
Android emulator → http://10.0.2.2:3000
iOS simulator / device → http://127.0.0.1:3000
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | Override backend base URL (recommended for real devices) |
| `EXPO_PUBLIC_MOCK_DEVICE_URL` | Override local CPM device URL (same Wi-Fi as phone) |
| `EXPO_PUBLIC_FORCE_MOCK_SESSIONS=1` | Force mock session data (development flag) |

---

## 4. User Roles & Navigation Flow

### 4.1 Routing Architecture

The app uses **Expo Router** (file-based routing), which maps the `app/` directory to URL-style routes. Route groups in parentheses (e.g., `(tabs)`, `(doctor)`) organise files without adding URL segments.

### 4.2 Full File-to-Route Map

```
app/
├── _layout.tsx                         # Root layout — auth gate, context providers
├── index.tsx                           # / → Role selection (Patient or Doctor)
├── patient-login.tsx                   # /patient-login → Phone number entry
├── doctor-login.tsx                    # /doctor-login → Email + password (JWT)
├── therapy-session.tsx                 # /therapy-session → Active CPM session
├── manual-setup.tsx                    # /manual-setup → Manual practice config
├── modal.tsx                           # /modal → Program form modal
├── (tabs)/
│   ├── _layout.tsx                     # Tab navigator (patient only)
│   ├── index.tsx                       # /(tabs) → Patient home dashboard
│   ├── programs.tsx                    # /(tabs)/programs → Session history
│   └── explore.tsx                     # /(tabs)/explore → Settings & profile
└── (doctor)/
    └── patient/
        └── [patientId]/
            ├── index.tsx               # /patient/[id] → Patient detail (tabbed)
            ├── prescription.tsx        # /patient/[id]/prescription → CPM form
            └── history.tsx             # /patient/[id]/history → Session history
```

### 4.3 Authentication & Role Routing

The root layout (`app/_layout.tsx`) reads `auth.isLoggedIn` and `auth.role` from `AuthContext` and conditionally renders different screen stacks:

```
App Launch
    │
    ▼
auth.isLoading?
    ├── YES → Loading spinner
    └── NO
         │
         ├── auth.isLoggedIn === false
         │       └── Stack: [ /, /patient-login, /doctor-login ]
         │
         └── auth.isLoggedIn === true
                 ├── role === 'patient'
                 │       └── Full stack including /(tabs)
                 │
                 └── role === 'doctor'
                         └── Full stack including /doctor + /patient/[id]/*
```

### 4.4 Patient Flow

```
/ (Role Selection)
    └── /patient-login (phone number)
            └── Auth: lookupPatientByPhone()
                    └── /(tabs)/index (Home Dashboard)
                        ├── View today's stats & treatment plan
                        ├── [Start Session] → /therapy-session
                        │       ├── PREPARATION → RUNNING → PAUSED → FINISHED
                        │       └── On finish: submitSession() to backend
                        ├── /(tabs)/programs (History & Progress)
                        │       └── Chart + session list (getPatientSessions)
                        └── /(tabs)/explore (Settings)
                                ├── Device pairing (DeviceConnectionModal)
                                ├── /manual-setup (custom angle/force config)
                                └── Logout → clears AsyncStorage → back to /
```

### 4.5 Doctor Flow

```
/ (Role Selection)
    └── /doctor-login (email + password)
            └── Auth: doctorLogin() → JWT token stored
                    └── /doctor (Overview Dashboard)
                        ├── Summary cards: Total Patients / Completed Today / Alerts
                        ├── Search patient by name or HN code
                        └── [Tap patient row]
                                └── /patient/[patientId] (Patient Detail — Tabbed)
                                    ├── Tab: ภาพรวม (Overview)
                                    │       ├── Today's stats (sessions, max flexion)
                                    │       └── Active treatment plan summary
                                    ├── Tab: ใบสั่งยา (Prescription)
                                    │       └── /patient/[id]/prescription
                                    │               ├── Pre-filled from GET /api/presets/:id
                                    │               ├── Validates: flexion 0–120°, ext 0–30°,
                                    │               │   speed 1–5, duration 1–60 min, force 0–50 N
                                    │               └── Save → POST (new) or PUT (update)
                                    └── Tab: ประวัติ (History)
                                            └── /patient/[id]/history
                                                    ├── Summary bar: avg ROM, avg pain, met count
                                                    ├── Paginated FlatList (20 per page)
                                                    └── SessionHistoryCard: Target vs Achieved,
                                                        Pain badge, "Target Met" chip
```

---

## 5. API Documentation

All requests go through the generic wrapper in `services/apiClient.ts`:

```
GET/POST/PUT/DELETE  {API_BASE}{endpoint}
Headers: Content-Type: application/json
         Accept: application/json
         Authorization: Bearer {token}   ← Doctor endpoints only
```

Response envelope:

```typescript
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

### 5.1 Authentication Endpoints

#### `POST /api/auth/login` — Doctor Login

**Auth:** None

**Request Body:**

```json
{
  "email": "doctor@hospital.com",
  "password": "secret"
}
```

**Response `200`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### `POST /api/patients/lookup` — Patient Login (by phone)

**Auth:** None

**Request Body:**

```json
{
  "phoneNumber": "0812345678"
}
```

**Response `200`:**

```json
{
  "patientId": 7,
  "name": "สมชาย มีสุข",
  "hospitalId": 1
}
```

---

### 5.2 Doctor — Patient Management

#### `GET /api/patients` — List Assigned Patients

**Auth:** `Bearer {doctorJwt}` · **Current client function:** `getDoctorPatientsWithStatus(authToken)`

**Response `200` (current — fields in _italic_ are not yet returned by backend):**

```json
{
  "patients": [
    {
      "id": 7,
      "name": "สมชาย มีสุข",
      "hnCode": "HN-20241001",
      "age": 45,
      "hospitalId": 1,
      "primaryDoctorId": 2,
      "createdAt": "2024-10-01T00:00:00.000Z",

      "lastSessionDate": "2025-05-16T09:30:00.000Z",
      "todayStatus": "normal",
      "todayPainLevel": 2
    }
  ]
}
```

**`todayStatus` values:**

| Value | Meaning |
|-------|---------|
| `"in_session"` | Patient has an active running session right now |
| `"alert_pain"` | Most recent session today had `painLevel >= 7` |
| `"normal"` | Has session(s) today AND `painLevel < 7` |
| `"no_session"` | No sessions recorded today |

> **Backend action required:** Add `lastSessionDate`, `todayStatus`, and `todayPainLevel` to the response. See [Section 5.5](#55-api-contracts-for-planned-doctor-features) for full contract.

---

### 5.3 Treatment Plan (Preset) Endpoints

#### `GET /api/presets/{patientId}` — Get Active Treatment Plan

**Auth:** None (public for now) · **Client function:** `getPatientPreset(patientId)`

**Response `200`:**

```json
{
  "id": 42,
  "targetFlexion": 90,
  "targetExtension": 0,
  "speedLevel": 3,
  "durationMinutes": 20,
  "useWarmup": true,
  "targetForceN": 15.5,
  "forceLevel": 3
}
```

---

### 5.4 Session Endpoints

#### `GET /api/patients/{patientId}/today-stats` — Today's Summary

**Auth:** None · **Client function:** `getPatientTodayStats(patientId)`

**Response `200`:**

```json
{
  "sessionsCompleted": 2,
  "totalSessionsTarget": 3,
  "totalMinutes": 40,
  "maxFlexion": 85,
  "targetFlexion": 90
}
```

---

#### `POST /api/sessions` — Submit Completed Session

**Auth:** None · **Client function:** `submitSession(payload)`

**Request Body:**

```json
{
  "patientId": 7,
  "planId": 42,
  "actualMaxFlexion": 85,
  "durationCompleted": 18,
  "isCustomUsed": false,
  "painLevel": 3,
  "actualForceUsed": 3,
  "actualMaxForceN": 14.2,
  "sessionDate": "2025-05-17T09:30:00.000Z"
}
```

**Response `201`:**

```json
{
  "id": 301,
  "patientId": 7,
  "planId": 42,
  "actualMaxFlexion": 85,
  "durationCompleted": 18,
  "isCustomUsed": false,
  "painLevel": 3,
  "actualForceUsed": 3,
  "actualMaxForceN": 14.2,
  "sessionDate": "2025-05-17T09:30:00.000Z",
  "plan": {
    "id": 42,
    "targetFlexion": 90,
    "targetExtension": 0,
    "durationMinutes": 20
  }
}
```

---

#### `GET /api/sessions/{patientId}` — Patient Session History

**Auth:** None (to be secured — see Section 5.5) · **Client function:** `getPatientSessions(patientId, options?)`

**Query Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fromDate` | ISO date string | No | Filter sessions from this date |
| `toDate` | ISO date string | No | Filter sessions until this date |
| `limit` | number | No | Maximum records (default: 50) |

**Response `200`:** Array of session objects (same shape as `POST /api/sessions` response).

---

### 5.5 API Contracts for Planned Doctor Features

These endpoints are **not yet implemented** by the backend. The following contracts should be sent to the backend developer.

---

#### CONTRACT 1 — Enrich `GET /api/patients` Response

Modify the existing endpoint to add 3 computed fields to each patient object:

| New Field | Type | Nullable | Description |
|-----------|------|----------|-------------|
| `lastSessionDate` | `string (ISO 8601)` | Yes | Most recent completed session timestamp; `null` if none |
| `todayStatus` | `"normal" \| "alert_pain" \| "in_session" \| "no_session"` | No | Computed status for today |
| `todayPainLevel` | `number (0–10)` | Yes | Pain level of most recent session today; `null` if no session |

**Status computation logic (backend):**

```
if patient has an active/running session now  → "in_session"
else if todayPainLevel >= 7                   → "alert_pain"
else if has any session today AND pain < 7    → "normal"
else                                          → "no_session"
```

---

#### CONTRACT 2 — `POST /api/presets/{patientId}` — Create New Prescription

**Auth:** `Bearer {doctorJwt}` · **Client function:** `createPreset(patientId, payload, authToken)`

**Request Body:**

```json
{
  "targetFlexion": 90,
  "targetExtension": 0,
  "speedLevel": 3,
  "durationMinutes": 20,
  "useWarmup": true,
  "targetForceN": 15.5
}
```

**Field Constraints:**

| Field | Type | Required | Range |
|-------|------|----------|-------|
| `targetFlexion` | number | ✅ | 0–120 degrees |
| `targetExtension` | number | ✅ | 0–30 degrees |
| `speedLevel` | integer | ✅ | 1–5 |
| `durationMinutes` | number | ✅ | 1–60 minutes |
| `useWarmup` | boolean | ✅ | — |
| `targetForceN` | number \| null | ❌ | 0–50 N · `null` disables force mode |

**Success Response `201 Created`:**

```json
{
  "id": 43,
  "patientId": 7,
  "targetFlexion": 90,
  "targetExtension": 0,
  "speedLevel": 3,
  "durationMinutes": 20,
  "useWarmup": true,
  "targetForceN": 15.5,
  "forceLevel": 3,
  "status": "active",
  "createdAt": "2025-05-17T10:00:00.000Z",
  "updatedAt": "2025-05-17T10:00:00.000Z"
}
```

**Business rule:** Creating a new preset must mark any previous active preset for this patient as `"inactive"`. Only one active preset per patient at a time.

**Error Responses:**

| Code | Meaning |
|------|---------|
| `400` | Invalid field values (out of range, missing required) |
| `401` | Missing or invalid JWT |
| `403` | This patient does not belong to the requesting doctor |
| `404` | `patientId` does not exist |

---

#### CONTRACT 3 — `PUT /api/presets/{patientId}` — Update Existing Prescription

**Auth:** `Bearer {doctorJwt}` · **Client function:** `updatePreset(patientId, payload, authToken)`

**Request Body:** Same schema as `POST /api/presets/{patientId}` above.

**Success Response `200 OK`:** Same schema as `POST 201` response.

**Business rule:** Updates the currently active preset **in-place** (does not create a new row). Use `POST` to version/archive. Returns `404` if no active preset exists.

---

#### CONTRACT 4 — Secure `GET /api/sessions/{patientId}` for Doctor Access

**Auth:** Add `Bearer {doctorJwt}` guard · **Client function:** `getDoctorPatientSessions(patientId, authToken, options?)`

**Additional Query Params (add to existing):**

| Param | Type | Description |
|-------|------|-------------|
| `offset` | number | Pagination offset (default: 0) |

**Updated Response Envelope:**

```json
{
  "sessions": [
    {
      "id": 301,
      "patientId": 7,
      "planId": 42,
      "sessionDate": "2025-05-16T09:30:00.000Z",
      "durationCompleted": 18,
      "actualMaxFlexion": 85,
      "isCustomUsed": false,
      "painLevel": 3,
      "actualForceUsed": 3,
      "actualMaxForceN": 14.2,
      "targetMet": true,
      "plan": {
        "id": 42,
        "targetFlexion": 90,
        "targetExtension": 0,
        "durationMinutes": 20
      }
    }
  ],
  "total": 24,
  "limit": 20,
  "offset": 0
}
```

**New `targetMet` field (backend computes this):**

```
targetMet = true
  if  actualMaxFlexion >= plan.targetFlexion
  AND durationCompleted >= plan.durationMinutes * 0.8
```

> **Note:** The frontend (`getDoctorPatientSessions`) gracefully handles both the new paginated envelope and the old plain-array response, so this change can be made on the backend without a coordinated deployment.

---

### 5.6 Mock CPM Device Endpoints (Local Network, Port 3000)

These are sent from `services/deviceService.ts` to the local CPM machine on the same Wi-Fi network. All are `POST` requests. The service automatically appends a `clientTimestamp` ISO string to every payload.

| Endpoint | Trigger | Key Payload Fields |
|----------|---------|-------------------|
| `POST /api/start-session` | User taps "Start" | `angleFlexion`, `angleExtension`, `speed`, `forceN`, `durationMinutes`, `isManualMode` |
| `POST /api/session-pause` | User taps "Pause" | `sessionState: 'PAUSED'`, `timeLeftSeconds`, current params |
| `POST /api/session-resume` | User taps "Resume" | `sessionState: 'RUNNING'`, `timeLeftSeconds`, current params |
| `POST /api/session-restart` | User taps "Restart" | `sessionState: 'RUNNING'`, `action: 'restart'`, `durationMinutes` |
| `POST /api/session-complete` | Timer expires or user finishes | `kind: 'timer_expired' \| 'user_finished'`, target params |
| `POST /api/session-params` | Parameter slider changed (debounced) | `action: 'parameters_update'`, all current params |
| `POST /api/emergency-stop` | User taps emergency stop | `timeLeftSeconds`, `targetFlexion`, `targetForceN` |

---

## 6. Design System & State Management

### 6.1 Design System (`constants/design-system.ts`)

All custom components use the following design tokens instead of hard-coded values.

#### Colour Palette — `DSColors`

| Token | Hex | Usage |
|-------|-----|-------|
| `DSColors.primary` | `#A00000` | University Red — primary CTA, active states, icons |
| `DSColors.primaryLight` | `#FCE9E9` | Light red — icon backgrounds, active tab tint |
| `DSColors.primaryDark` | `#7A0000` | Pressed state |
| `DSColors.success` | `#10B981` | Completed sessions, "Normal" status |
| `DSColors.successLight` | `#D1FAE5` | Success chip background |
| `DSColors.warning` | `#F59E0B` | Mid-range pain levels |
| `DSColors.danger` | `#EF4444` | Alert pain status, errors |
| `DSColors.dangerLight` | `#FEE2E2` | Danger chip background |
| `DSColors.background` | `#F5F5F5` | Screen background |
| `DSColors.surface` | `#FFFFFF` | Card / sheet surface |
| `DSColors.border` | `#E5E7EB` | Standard border |
| `DSColors.borderLight` | `#F3F4F6` | List separators |
| `DSColors.text.primary` | `#333333` | Body text |
| `DSColors.text.secondary` | `#6B7280` | Labels, hints, subtitles |

#### Typography — `DSTypography`

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| `h1` | 28px | Bold | Screen titles |
| `h2` | 22px | Bold | Section headings |
| `h3` | 18px | SemiBold | Card titles |
| `body` | 16px | Regular | Default text |
| `bodyBold` | 16px | SemiBold | Emphasised body text |
| `caption` | 14px | Regular | Subtitles, metadata |
| `captionBold` | 14px | SemiBold | Status badges, labels |
| `small` | 12px | Regular | Hints, secondary info |
| `data` | 32px | Bold | Large numeric KPIs |
| `dataSmall` | 24px | Bold | Smaller numeric KPIs |

#### Spacing & Shape — `DSLayout` / `DSShape`

| Token | Value | Usage |
|-------|-------|-------|
| `DSLayout.screenPadding` | 20px | Horizontal screen margin |
| `DSLayout.cardPadding` | 20px | Inner card padding |
| `DSLayout.sectionGap` | 24px | Space between sections |
| `DSLayout.itemGap` | 12px | Space between list items |
| `DSShape.radiusCard` | 20px | Card border radius |
| `DSShape.radiusButton` | 16px | Button border radius |
| `DSShape.radiusChip` | 12px | Badge/chip border radius |

#### Shadows

| Token | Usage |
|-------|-------|
| `DSShadow` | Card shadow (slightly prominent) |
| `DSShadowSoft` | Input, search bar, subtle container shadow |

### 6.2 Styling Convention

The project uses **two styling methods**:

1. **`StyleSheet.create({})` + design tokens** — Used in all production components. This is the primary approach.
2. **NativeWind (Tailwind `className` prop)** — Configured via `tailwind.config.js` and `global.css`. Available but used sparingly.

### 6.3 State Management

The app uses **React Context API** for global state. There is no Redux or Zustand.

#### `AuthContext` (`contexts/AuthContext.tsx`)

Persisted to `AsyncStorage`. Available via `useAuth()` hook.

```typescript
type AuthState = {
  isLoggedIn: boolean        // Derived: role !== null
  isLoading: boolean         // True while restoring from AsyncStorage on launch
  role: 'patient' | 'doctor' | null
  identifier: string | null  // Phone number (patient) or email (doctor)
  patientId: number | null   // Set after patient lookup
  patientName: string | null
  authToken: string | null   // JWT for doctor; null for patient

  loginPatient(phoneNumber: string): Promise<void>
  loginDoctor(email: string, password: string): Promise<void>
  logout(): Promise<void>
}
```

**AsyncStorage keys:**

| Key | Value |
|-----|-------|
| `@cpe465_auth_role` | `'patient'` \| `'doctor'` |
| `@cpe465_auth_identifier` | Phone or email |
| `@cpe465_auth_patientId` | Number (patient only) |
| `@cpe465_auth_patientName` | Display name (patient only) |
| `@cpe465_auth_token` | JWT (doctor only) |

#### `DevicePairedContext` (`contexts/DevicePairedContext.tsx`)

Tracks whether the patient has paired their CPM device. Persisted per `patientId`.

```typescript
{
  isPaired: boolean
  hydrated: boolean
  markDevicePaired(): Promise<void>
  clearDevicePaired(): Promise<void>
}
```

**AsyncStorage key:** `@cpe465_cpm_device_paired:{patientId}`

#### Component-Level State

All API data (patient stats, session lists, preset values) is fetched and managed **locally within each screen component** using `useState` + `useEffect`. There is no global data cache. Screens re-fetch on mount.

---

## Appendix — Component Directory Reference

```
components/
├── screens/
│   ├── ActiveTherapySession.tsx       # Full CPM session UI (2000+ lines)
│   ├── DoctorLoginScreen.tsx          # Doctor email/password login form
│   ├── DoctorOverviewDashboard.tsx    # Doctor patient list + summary cards
│   ├── DoctorPatientDetail.tsx        # Doctor patient detail (tabbed)
│   ├── DoctorPatientHistory.tsx       # Doctor session history list
│   ├── DoctorPrescriptionForm.tsx     # CPM parameter prescription form
│   ├── LoginScreenShell.tsx           # Shared login layout + primitives
│   ├── PatientHomeDashboard.tsx       # Patient home — plan, calendar, stats
│   ├── PhoneLoginScreen.tsx           # Patient phone login form
│   └── RoleSelectionScreen.tsx        # Entry screen — choose Patient or Doctor
├── ui/
│   ├── CircularTimer.tsx              # SVG countdown ring (session timer)
│   ├── DeviceConnectionModal.tsx      # Bluetooth-style device pairing modal
│   ├── KneeIcon.tsx                   # Branded joint icon
│   ├── PatientStatusBadge.tsx         # Status chip (normal / alert / in_session)
│   ├── SessionHistoryCard.tsx         # Single session record card
│   ├── collapsible.tsx                # Expandable section wrapper
│   └── icon-symbol.tsx                # SF Symbols cross-platform wrapper
├── CustomHeader.tsx                   # App-wide header with branding
├── themed-text.tsx                    # Theme-aware Text wrapper
└── themed-view.tsx                    # Theme-aware View wrapper
```

---

*This document was generated from live codebase analysis on 2025-05-17.*
