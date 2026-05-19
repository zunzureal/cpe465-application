/**
 * Mock API Client - Returns fake data for development without backend server
 * Simulates all backend responses for testing the app UI/flow
 */

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Mock patient data
const mockPatients = [
  {
    id: 1,
    name: 'สมชาย ใจดี',
    hnCode: 'HN-001',
    phoneNumber: '0812345678',
    age: 45,
    surgeryLocation: 'เข่าขวา',
    machineId: 1,
  },
  {
    id: 2,
    name: 'สมหญิง หวังดี',
    hnCode: 'HN-002',
    phoneNumber: '0887654321',
    age: 52,
    surgeryLocation: 'เข่าซ้าย',
    machineId: 2,
  },
  {
    id: 5,
    name: 'นางสมหญิง อำนาจ',
    hnCode: 'HN-192331',
    phoneNumber: '0898765432',
    age: 48,
    surgeryLocation: 'เข่าขวา',
    machineId: 1,
  },
];

// Mock preset data per patient
const mockPresets: Record<number, any> = {
  1: {
    patientId: 1,
    flexion: 120,
    extension: 0,
    speed: 5,
    duration: 10,
    warmUp: true,
    targetForceN: 70,
    forceLevel: 1,
  },
  2: {
    patientId: 2,
    flexion: 110,
    extension: 5,
    speed: 6,
    duration: 12,
    warmUp: true,
    targetForceN: 65,
    forceLevel: 2,
  },
  5: {
    patientId: 5,
    flexion: 120,
    extension: 0,
    speed: 5,
    duration: 10,
    warmUp: true,
    targetForceN: 70,
    forceLevel: 1,
  },
};

// Mock sessions per patient
const mockSessions: Record<number, any[]> = {
  1: [
    {
      id: 1,
      patientId: 1,
      sessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 100,
      sessionStatus: 'completed',
    },
    {
      id: 2,
      patientId: 1,
      sessionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 105,
      sessionStatus: 'completed',
    },
    {
      id: 3,
      patientId: 1,
      sessionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 110,
      sessionStatus: 'completed',
    },
    {
      id: 4,
      patientId: 1,
      sessionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 115,
      sessionStatus: 'completed',
    },
    {
      id: 5,
      patientId: 1,
      sessionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 118,
      sessionStatus: 'completed',
    },
    {
      id: 6,
      patientId: 1,
      sessionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 120,
      sessionStatus: 'completed',
    },
    {
      id: 7,
      patientId: 1,
      sessionDate: new Date().toISOString(),
      actualMaxFlexion: 120,
      sessionStatus: 'completed',
    },
  ],
  5: [
    {
      id: 10,
      patientId: 5,
      sessionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 95,
      sessionStatus: 'completed',
    },
    {
      id: 11,
      patientId: 5,
      sessionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 110,
      sessionStatus: 'completed',
    },
    {
      id: 12,
      patientId: 5,
      sessionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      actualMaxFlexion: 115,
      sessionStatus: 'completed',
    },
  ],
};

// Mock auth
async function mockLoginDoctor(phoneNumber: string, password: string): Promise<ApiResponse<{ token: string; userId: number }>> {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (phoneNumber === '0812345678' && password === '1234') {
    return {
      success: true,
      data: { token: 'mock-doctor-token-12345', userId: 1 },
    };
  }
  return { success: false, error: 'Invalid credentials' };
}

async function mockLoginPatient(phoneNumber: string, password: string): Promise<ApiResponse<{ token: string; userId: number }>> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (phoneNumber === '0898765432' && password === '1234') {
    return {
      success: true,
      data: { token: 'mock-patient-token-12345', userId: 5 },
    };
  }
  return { success: false, error: 'Invalid credentials' };
}

async function mockGetDoctorPatients(authToken: string): Promise<ApiResponse<{ patients: any[] }>> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true, data: { patients: mockPatients } };
}

async function mockCreatePatient(authToken: string, payload: any): Promise<ApiResponse<any>> {
  await new Promise(resolve => setTimeout(resolve, 400));
  const newPatient = {
    id: Math.max(...mockPatients.map(p => p.id)) + 1,
    ...payload,
  };
  mockPatients.push(newPatient);
  mockPresets[newPatient.id] = { patientId: newPatient.id, flexion: 120, extension: 0, speed: 5, duration: 10, warmUp: true, targetForceN: 70, forceLevel: 1 };
  mockSessions[newPatient.id] = [];
  return { success: true, data: newPatient };
}

async function mockGetDoctorPatient(authToken: string, patientId: number): Promise<ApiResponse<any>> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const patient = mockPatients.find(p => p.id === patientId);
  return patient ? { success: true, data: patient } : { success: false, error: 'Patient not found' };
}

async function mockGetPatientPreset(patientId: number): Promise<ApiResponse<any>> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const preset = mockPresets[patientId];
  return preset ? { success: true, data: preset } : { success: false, error: 'Preset not found' };
}

async function mockPutPatientPreset(authToken: string, patientId: number, payload: any): Promise<ApiResponse<any>> {
  await new Promise(resolve => setTimeout(resolve, 400));
  mockPresets[patientId] = { patientId, ...payload };
  return { success: true, data: mockPresets[patientId] };
}

async function mockGetPatientSessions(patientId: number, options?: any): Promise<ApiResponse<any[]>> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const sessions = mockSessions[patientId] || [];
  return { success: true, data: sessions };
}

export const mockApiClient = {
  loginDoctor: mockLoginDoctor,
  loginPatient: mockLoginPatient,
  getDoctorPatients: mockGetDoctorPatients,
  createPatient: mockCreatePatient,
  getDoctorPatient: mockGetDoctorPatient,
  getPatientPreset: mockGetPatientPreset,
  putPatientPreset: mockPutPatientPreset,
  getPatientSessions: mockGetPatientSessions,
};
