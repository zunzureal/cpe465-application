/**
 * Active Therapy Session – Full CPM session flow.
 * States: PREPARATION → RUNNING/PAUSED → FINISHED.
 * API: GET presets on mount; POST session results after pain-level selection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── API config ───────────────────────────────────────────────────────────
// Priority:
// 1) EXPO_PUBLIC_API_BASE_URL (recommended; supports real device + any env)
// 2) Platform defaults for local development
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');
const MOCK_PATIENT_ID = 1;

// ─── Types ───────────────────────────────────────────────────────────────
type SessionState = 'PREPARATION' | 'RUNNING' | 'PAUSED' | 'FINISHED';

/** Machine preset from doctor's dashboard (API). Force in Newtons (N). */
export interface DoctorPresets {
  flexionDegree: number;
  extensionDegree: number;
  speed: number;
  holdTime: number;
  durationMinutes: number;
  useWarmUp: boolean;
  /** Resistance force threshold in Newtons (N) – safety limit from doctor. */
  targetForceN: number;
}

interface TreatmentPlanApiResponse {
  id: number;
  targetFlexion: number;
  targetExtension: number;
  speedLevel: number;
  durationMinutes: number;
  useWarmup: boolean;
  targetForceN?: number | null;
}

/** Alias for treatment/machine preset from API (used by API layer). */
export type MachinePreset = DoctorPresets;

const DEFAULT_PRESETS: DoctorPresets = {
  flexionDegree: 90,
  extensionDegree: 0,
  speed: 3,
  holdTime: 2,
  durationMinutes: 15,
  useWarmUp: true,
  targetForceN: 10,
};

/** Safe defaults for Manual Practice (no doctor preset). */
const MANUAL_DEFAULTS = {
  flexionDegree: 50,
  extensionDegree: 0,
  speed: 3,
  holdTime: 2,
  durationMinutes: 20,
  useWarmUp: true,
  targetForceN: 10,
};

const PRESET_WARM_UP_SECONDS = 5;
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Theme by mode: Doctor = medical blue/green; Manual = orange/teal
const THEME_DOCTOR = {
  primary: '#0B8FAC',
  primaryLight: '#E8F6FA',
  success: '#10B981',
  successBg: '#ECFDF5',
};
const THEME_MANUAL = {
  primary: '#E67E22',
  primaryLight: '#FEF3E2',
  success: '#10B981',
  successBg: '#ECFDF5',
};

export interface ActiveTherapySessionProps {
  /** When true, manual free practice (orange theme, editable, warning). When false, doctor's plan (blue/green, read-only). */
  isManualMode?: boolean;
}

export function ActiveTherapySession({ isManualMode = false }: ActiveTherapySessionProps) {
  const router = useRouter();
  const theme = isManualMode ? THEME_MANUAL : THEME_DOCTOR;

  // Presets: Doctor mode from API; Manual mode uses MANUAL_DEFAULTS.
  const [doctorPresets, setDoctorPresets] = useState<DoctorPresets | null>(null);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(!isManualMode);
  const [presetError, setPresetError] = useState<string | null>(null);

  const presets = isManualMode ? { ...MANUAL_DEFAULTS, ...doctorPresets } as DoctorPresets : (doctorPresets ?? DEFAULT_PRESETS);

  // User-adjustable targets. Doctor: init from API. Manual: init from safe defaults.
  const [targetFlexion, setTargetFlexion] = useState(isManualMode ? MANUAL_DEFAULTS.flexionDegree : DEFAULT_PRESETS.flexionDegree);
  const [targetExtension, setTargetExtension] = useState(isManualMode ? MANUAL_DEFAULTS.extensionDegree : DEFAULT_PRESETS.extensionDegree);
  const [targetSpeed, setTargetSpeed] = useState(isManualMode ? MANUAL_DEFAULTS.speed : DEFAULT_PRESETS.speed);
  const [targetForceN, setTargetForceN] = useState(isManualMode ? MANUAL_DEFAULTS.targetForceN : DEFAULT_PRESETS.targetForceN);
  const [isCustomSettings, setIsCustomSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_PRESETS.durationMinutes * 60);
  const [sessionState, setSessionState] = useState<SessionState>('PREPARATION');
  const [isWarmingUp, setIsWarmingUp] = useState(DEFAULT_PRESETS.useWarmUp);

  // Post-session: pain level (1=😃, 2=😐, 3=😫) and submit status
  const [painLevel, setPainLevel] = useState<1 | 2 | 3 | null>(null);
  const [postResultStatus, setPostResultStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // For FINISHED summary and session result POST
  const timeCompletedRef = useRef(0);
  const maxFlexionRef = useRef(presets.flexionDegree);
  const actualMaxForceNRef = useRef(presets.targetForceN);
  const targetFlexionRef = useRef(targetFlexion);
  const targetForceNRef = useRef(targetForceN);
  targetFlexionRef.current = targetFlexion;
  targetForceNRef.current = targetForceN;
  const sessionStateRef = useRef(sessionState);
  sessionStateRef.current = sessionState;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch presets on mount (Doctor mode only). Manual mode uses MANUAL_DEFAULTS.
  useEffect(() => {
    if (isManualMode) {
      setDoctorPresets(null);
      setActivePlanId(null);
      setTargetFlexion(MANUAL_DEFAULTS.flexionDegree);
      setTargetExtension(MANUAL_DEFAULTS.extensionDegree);
      setTargetSpeed(MANUAL_DEFAULTS.speed);
      setTargetForceN(MANUAL_DEFAULTS.targetForceN);
      setTimeLeft(MANUAL_DEFAULTS.durationMinutes * 60);
      setIsWarmingUp(MANUAL_DEFAULTS.useWarmUp);
      setLoadingPresets(false);
      return;
    }
    let cancelled = false;
    const url = `${API_BASE}/api/presets/${MOCK_PATIENT_ID}`;
    setLoadingPresets(true);
    setPresetError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TreatmentPlanApiResponse) => {
        if (cancelled) return;
        const presetsFromApi = {
          ...DEFAULT_PRESETS,
          flexionDegree: Number(data.targetFlexion ?? DEFAULT_PRESETS.flexionDegree),
          extensionDegree: Number(data.targetExtension ?? DEFAULT_PRESETS.extensionDegree),
          speed: Number(data.speedLevel ?? DEFAULT_PRESETS.speed),
          durationMinutes: Number(data.durationMinutes ?? DEFAULT_PRESETS.durationMinutes),
          useWarmUp: Boolean(data.useWarmup ?? DEFAULT_PRESETS.useWarmUp),
          targetForceN: typeof data.targetForceN === 'number' ? data.targetForceN : DEFAULT_PRESETS.targetForceN,
        };
        setActivePlanId(Number(data.id));
        setDoctorPresets(presetsFromApi);
        setTargetFlexion(presetsFromApi.flexionDegree);
        setTargetExtension(presetsFromApi.extensionDegree);
        setTargetSpeed(presetsFromApi.speed);
        setTargetForceN(presetsFromApi.targetForceN);
        setTimeLeft(presetsFromApi.durationMinutes * 60);
        setIsWarmingUp(presetsFromApi.useWarmUp);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setPresetError(err.message ?? 'Failed to load presets');
        setActivePlanId(null);
        setDoctorPresets(DEFAULT_PRESETS);
        Alert.alert(
          'ไม่สามารถโหลดแผนการรักษา',
          'ใช้ค่าเริ่มต้นแทน กรุณาตรวจสอบการเชื่อมต่อเครือข่ายหรือที่อยู่เซิร์ฟเวอร์\n\n' + (err.message ?? ''),
          [{ text: 'ตกลง' }]
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingPresets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isManualMode]);

  // Timer: store in ref, clear in cleanup (unmount or pause). Only run when RUNNING.
  useEffect(() => {
    if (sessionState !== 'RUNNING' || timeLeft <= 0) return;
    const durationSeconds = presets.durationMinutes * 60;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setSessionState('FINISHED');
          timeCompletedRef.current = durationSeconds;
          maxFlexionRef.current = targetFlexionRef.current;
          actualMaxForceNRef.current = targetForceNRef.current;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionState, presets.durationMinutes]);

  // AppState: when app goes inactive/background while RUNNING, auto-pause (safety)
  useEffect(() => {
    const handleAppStateChange = (next: AppStateStatus) => {
      if (next.match(/inactive|background/) && sessionStateRef.current === 'RUNNING') {
        setSessionState('PAUSED');
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  // When all params match presets, clear custom flag
  useEffect(() => {
    if (
      targetFlexion === presets.flexionDegree &&
      targetExtension === presets.extensionDegree &&
      targetSpeed === presets.speed &&
      targetForceN === presets.targetForceN
    ) {
      setIsCustomSettings(false);
    }
  }, [targetFlexion, targetExtension, targetSpeed, targetForceN, presets.flexionDegree, presets.extensionDegree, presets.speed, presets.targetForceN]);

  // Warm-up: set isWarmingUp to false after 5 seconds when RUNNING
  useEffect(() => {
    if (sessionState !== 'RUNNING' || !isWarmingUp) return;
    const t = setTimeout(() => setIsWarmingUp(false), PRESET_WARM_UP_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [sessionState, isWarmingUp]);

  // Pulsing animation for warm-up badge
  useEffect(() => {
    if (!isWarmingUp || sessionState !== 'RUNNING') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, useNativeDriver: true, duration: 600 }),
        Animated.timing(pulseAnim, { toValue: 0.98, useNativeDriver: true, duration: 600 }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isWarmingUp, sessionState]);

  const handleStartSession = useCallback(() => {
    setSessionState('RUNNING');
    setTimeLeft(presets.durationMinutes * 60);
    setIsWarmingUp(presets.useWarmUp);
    setPainLevel(null);
    setPostResultStatus('idle');
  }, [presets.durationMinutes, presets.useWarmUp]);

  const handleEmergencyStop = useCallback(() => {
    const durationSeconds = presets.durationMinutes * 60;
    const elapsed = durationSeconds - timeLeft;
    timeCompletedRef.current = elapsed;
    maxFlexionRef.current = targetFlexion;
    actualMaxForceNRef.current = targetForceNRef.current;
    setSessionState('FINISHED');
  }, [timeLeft, targetFlexion, presets.durationMinutes]);

  const handlePause = useCallback(() => {
    setSessionState((s) => (s === 'RUNNING' ? 'PAUSED' : 'RUNNING'));
  }, []);

  // Steppers always active: patient can adjust at any time (e.g. in case of pain).
  const FLEXION_MIN = 0;
  const FLEXION_MAX = 120;
  const atMinFlexion = targetFlexion <= FLEXION_MIN;
  const atMaxFlexion = targetFlexion >= FLEXION_MAX;
  const adjustFlexion = useCallback(
    (delta: number) => {
      const next = Math.max(FLEXION_MIN, Math.min(FLEXION_MAX, targetFlexion + delta));
      setTargetFlexion(next);
      if (!isManualMode && next !== presets.flexionDegree) setIsCustomSettings(true);
    },
    [targetFlexion, isManualMode, presets.flexionDegree]
  );

  const EXTENSION_MIN = -10;
  const EXTENSION_MAX = 0;
  const atMinExtension = targetExtension <= EXTENSION_MIN;
  const atMaxExtension = targetExtension >= EXTENSION_MAX;
  const adjustExtension = useCallback(
    (delta: number) => {
      const next = Math.max(EXTENSION_MIN, Math.min(EXTENSION_MAX, targetExtension + delta));
      setTargetExtension(next);
      if (!isManualMode && next !== presets.extensionDegree) setIsCustomSettings(true);
    },
    [targetExtension, isManualMode, presets.extensionDegree]
  );

  const SPEED_MIN = 1;
  const SPEED_MAX = 5;
  const atMinSpeed = targetSpeed <= SPEED_MIN;
  const atMaxSpeed = targetSpeed >= SPEED_MAX;
  const adjustSpeed = useCallback(
    (delta: number) => {
      const next = Math.max(SPEED_MIN, Math.min(SPEED_MAX, targetSpeed + delta));
      setTargetSpeed(next);
      if (!isManualMode && next !== presets.speed) setIsCustomSettings(true);
    },
    [targetSpeed, isManualMode, presets.speed]
  );

  const FORCE_STEP = 5;
  const FORCE_MIN = 10;
  const FORCE_MAX = 150;
  const atMinForce = targetForceN <= FORCE_MIN;
  const atMaxForce = targetForceN >= FORCE_MAX;
  const adjustForceN = useCallback(
    (delta: number) => {
      const next = Math.max(FORCE_MIN, Math.min(FORCE_MAX, targetForceN + delta));
      setTargetForceN(next);
      if (!isManualMode && next !== presets.targetForceN) setIsCustomSettings(true);
    },
    [targetForceN, isManualMode, presets.targetForceN]
  );

  // Doctor's plan: show "customized value" warning when current value differs from preset
  const customFlexion = !isManualMode && targetFlexion !== presets.flexionDegree;
  const customExtension = !isManualMode && targetExtension !== presets.extensionDegree;
  const customSpeed = !isManualMode && targetSpeed !== presets.speed;
  const customForce = !isManualMode && targetForceN !== presets.targetForceN;

  const submitSessionResults = useCallback(async () => {
    if (painLevel === null) return;
    if (!activePlanId) {
      setPostResultStatus('error');
      Alert.alert(
        'ส่งผลไม่สำเร็จ',
        'ไม่พบแผนการรักษาที่ใช้งานอยู่สำหรับผู้ป่วยนี้ กรุณาโหลดแผนใหม่อีกครั้ง',
        [{ text: 'ตกลง' }]
      );
      return;
    }
    setPostResultStatus('pending');
    const completed = timeCompletedRef.current;
    const actualMaxFlexion = maxFlexionRef.current;
    const actualMaxForceN = actualMaxForceNRef.current;
    const payload = {
      patientId: MOCK_PATIENT_ID,
      planId: activePlanId,
      sessionDate: new Date().toISOString(),
      actualMaxFlexion,
      durationCompleted: completed,
      painLevel,
      isCustomUsed: isCustomSettings,
      actualMaxForceN,
    };
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPostResultStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setPostResultStatus('error');
      Alert.alert(
        'ส่งผลไม่สำเร็จ',
        'ไม่สามารถส่งผลเซสชันได้ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง\n\n' + message,
        [{ text: 'ตกลง' }]
      );
    }
  }, [painLevel, isCustomSettings, activePlanId]);

  // ─── Loading presets ───────────────────────────────────────────────────
  if (loadingPresets) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>กำลังโหลดแผนการรักษา...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── PREPARATION ────────────────────────────────────────────────────────
  if (sessionState === 'PREPARATION') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.preparationScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.preparationIconWrap, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="body" size={80} color={theme.primary} />
          </View>
          <Text style={styles.preparationTitle}>เตรียมพร้อมก่อนเริ่ม</Text>
          <Text style={styles.preparationMessage}>
            กรุณาวางขาลงบนเครื่องและรัดสายให้เรียบร้อย
          </Text>
          <Text style={styles.preparationSub}>Please place your leg on the machine and secure the straps.</Text>

          {isManualMode && (
            <View style={[styles.manualWarningBanner, { backgroundColor: THEME_MANUAL.primaryLight, borderColor: theme.primary }]}>
              <Text style={[styles.manualWarningText, { color: theme.primary }]}>
                อย่าฝืนทำหากรู้สึกเจ็บปวด (Do not force if you feel pain)
              </Text>
            </View>
          )}

          <View style={[styles.planCard, isManualMode && { borderColor: theme.primary + '40' }]}>
            <Text style={[styles.planTitle, isManualMode && { color: theme.primary }]}>
              {isManualMode ? 'โหมดฝึกอิสระ (Manual Practice)' : 'สรุปแผนวันนี้ (Doctor\'s Plan)'}
            </Text>
            {isManualMode && (
              <Text style={[styles.planSubtitle, { color: '#6B7280' }]}>
                ฝึกเพิ่มเติมตามความเหมาะสม (Additional practice at your own pace)
              </Text>
            )}
            {!isManualMode && (
              <Text style={[styles.planSubtitle, { color: '#6B7280' }]}>
                ปฏิบัติตามคำสั่งแพทย์ (Following your doctor's plan)
              </Text>
            )}
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>งอเข่า (Bend)</Text>
              <Text style={styles.planValue}>{presets.flexionDegree}°</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>วางขาราบ (Extension)</Text>
              <Text style={styles.planValue}>{presets.extensionDegree}°</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>ความเร็ว (Speed)</Text>
              <Text style={styles.planValue}>Level {presets.speed}</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>คงค้างที่จุดสิ้นสุด</Text>
              <Text style={styles.planValue}>{presets.holdTime} วินาที</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>ระยะเวลา</Text>
              <Text style={styles.planValue}>{presets.durationMinutes} นาที</Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Safety Force Limit (แรงจำกัด)</Text>
              <Text style={styles.planValue}>{presets.targetForceN} N</Text>
            </View>
            {presets.useWarmUp && (
              <Text style={styles.planNote}>รวมช่วงวอร์มอัพข้อต่อ</Text>
            )}
          </View>

          <TouchableOpacity activeOpacity={0.7} style={[styles.startButton, { backgroundColor: theme.primary }]} onPress={handleStartSession}>
            <Ionicons name="play" size={24} color="#FFFFFF" />
            <Text style={styles.buttonLabel}>เริ่มการรักษา</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── FINISHED: pain level → POST → success ───────────────────────────────
  if (sessionState === 'FINISHED') {
    const completed = timeCompletedRef.current;
    const maxFlex = maxFlexionRef.current;

    // Step 1: Ask for pain level, then submit
    if (postResultStatus !== 'success') {
      return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView contentContainerStyle={styles.finishedContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.painQuestionTitle}>ระดับความเจ็บปวดหลังเซสชัน?</Text>
            <Text style={styles.painQuestionSub}>Pain level after session</Text>
            <View style={styles.painLevelRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.painLevelBtn, painLevel === 1 && styles.painLevelBtnSelected]}
                onPress={() => setPainLevel(1)}
              >
                <Text style={styles.painLevelEmoji}>😃</Text>
                <Text style={styles.painLevelLabel}>ไม่เจ็บ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.painLevelBtn, painLevel === 2 && styles.painLevelBtnSelected]}
                onPress={() => setPainLevel(2)}
              >
                <Text style={styles.painLevelEmoji}>😐</Text>
                <Text style={styles.painLevelLabel}>ปานกลาง</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.painLevelBtn, painLevel === 3 && styles.painLevelBtnSelected]}
                onPress={() => setPainLevel(3)}
              >
                <Text style={styles.painLevelEmoji}>😫</Text>
                <Text style={styles.painLevelLabel}>เจ็บมาก</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.startButton, (painLevel === null || postResultStatus === 'pending') && styles.buttonDisabled]}
              onPress={submitSessionResults}
              disabled={painLevel === null || postResultStatus === 'pending'}
            >
              {postResultStatus === 'pending' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonLabel}>ส่งผล (Submit)</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Step 2: Success summary + Back to home
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.finishedContainer}>
          <View style={styles.finishedIconWrap}>
            <Ionicons name="checkmark-circle" size={100} color="#10B981" />
          </View>
          <Text style={styles.finishedTitle}>ทำกายภาพสำเร็จ!</Text>
          <Text style={styles.finishedSub}>Session Complete!</Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>สรุปเซสชัน</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>เวลาที่ทำ</Text>
              <Text style={styles.summaryValue}>{formatTime(completed)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>งอเข่าสูงสุด</Text>
              <Text style={styles.summaryValue}>{maxFlex}°</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.buttonLabel}>กลับหน้าหลัก (Back to Home)</Text>
            <Ionicons name="home" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── RUNNING / PAUSED ───────────────────────────────────────────────────
  const isPaused = sessionState === 'PAUSED';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode header */}
        <View style={[styles.modeHeader, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '50' }]}>
          <Text style={[styles.modeHeaderTitle, { color: theme.primary }]}>
            {isManualMode ? 'โหมดฝึกอิสระ (Manual Practice)' : 'การรักษาประจำวัน (Doctor\'s Prescription)'}
          </Text>
          <Text style={styles.modeHeaderSub}>
            {isManualMode ? 'ฝึกเพิ่มเติมตามความเหมาะสม' : 'ปฏิบัติตามคำสั่งแพทย์ (Following your doctor\'s plan)'}
          </Text>
          {isManualMode && (
            <Text style={[styles.modeHeaderWarning, { color: theme.primary }]}>
              อย่าฝืนทำหากรู้สึกเจ็บปวด (Do not force if you feel pain)
            </Text>
          )}
        </View>

        {/* Timer */}
        <View style={styles.timerSection}>
          {isPaused && (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedBadgeText}>⏸️ หยุดชั่วคราว</Text>
            </View>
          )}
          <Text style={styles.timerLabel}>เวลาที่เหลือ</Text>
          <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
          <Text style={styles.timerHint}>นาที</Text>
        </View>

        {/* Warm-up badge */}
        {isWarmingUp && sessionState === 'RUNNING' && (
          <Animated.View
            style={[
              styles.warmUpBadge,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.warmUpText}>
              🏃‍♂️ ระบบกำลังวอร์มอัพข้อต่อให้คุ้นเคย (Warming up...)
            </Text>
          </Animated.View>
        )}

        {/* Status badge */}
        <View style={styles.statusBadgeWrap}>
          {isManualMode ? (
            <View style={[styles.statusBadgeSuccess, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
              <Text style={[styles.statusBadgeSuccessText, { color: theme.primary }]}>
                โหมดฝึกอิสระ (Manual Practice)
              </Text>
            </View>
          ) : isCustomSettings ? (
            <View style={styles.statusBadgeWarning}>
              <Text style={styles.statusBadgeWarningText}>
                ⚠️ คุณกำลังใช้ค่าปรับตั้งเอง (Custom Settings)
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadgeSuccess, styles.statusBadgeRow]}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" style={styles.statusBadgeIcon} />
              <Text style={styles.statusBadgeSuccessText}>
                ทำตามแผนคุณหมอ (Doctor's Plan)
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.safetyForceBanner, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
          <Text style={styles.safetyForceBannerText}>Safety Force Limit: {targetForceN} N</Text>
        </View>

        {/* Parameter cards – steppers always active (patient can adjust for pain) */}
        <View style={styles.paramCard}>
          <Text style={styles.paramCardTitle}>งอเข่า (Bend Knee)</Text>
          <Text style={styles.paramCardSub}>Target flexion</Text>
          <View style={styles.paramRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMinFlexion && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustFlexion(-5)}
              disabled={atMinFlexion}
            >
              <Ionicons name="remove" size={30} color={atMinFlexion ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.paramValue, { color: theme.primary }]}>{targetFlexion}°</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMaxFlexion && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustFlexion(5)}
              disabled={atMaxFlexion}
            >
              <Ionicons name="add" size={30} color={atMaxFlexion ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
          </View>
          {customFlexion && (
            <Text style={styles.customWarningTag}>⚠️ คุณกำลังใช้ค่าที่ต่างจากแพทย์สั่ง (Customized value)</Text>
          )}
        </View>

        <View style={styles.paramCard}>
          <Text style={styles.paramCardTitle}>วางขาราบ (Straighten Leg)</Text>
          <Text style={styles.paramCardSub}>Target extension</Text>
          <View style={styles.paramRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMinExtension && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustExtension(-5)}
              disabled={atMinExtension}
            >
              <Ionicons name="remove" size={30} color={atMinExtension ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.paramValue, { color: theme.primary }]}>{targetExtension}°</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMaxExtension && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustExtension(5)}
              disabled={atMaxExtension}
            >
              <Ionicons name="add" size={30} color={atMaxExtension ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
          </View>
          {customExtension && (
            <Text style={styles.customWarningTag}>⚠️ คุณกำลังใช้ค่าที่ต่างจากแพทย์สั่ง (Customized value)</Text>
          )}
        </View>

        <View style={styles.paramCard}>
          <Text style={styles.paramCardTitle}>ความเร็ว (Speed)</Text>
          <Text style={styles.paramCardSub}>Level 1–5</Text>
          <View style={styles.paramRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMinSpeed && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustSpeed(-1)}
              disabled={atMinSpeed}
            >
              <Ionicons name="remove" size={30} color={atMinSpeed ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.paramValue, { color: theme.primary }]}>{targetSpeed}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMaxSpeed && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustSpeed(1)}
              disabled={atMaxSpeed}
            >
              <Ionicons name="add" size={30} color={atMaxSpeed ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
          </View>
          {customSpeed && (
            <Text style={styles.customWarningTag}>⚠️ คุณกำลังใช้ค่าที่ต่างจากแพทย์สั่ง (Customized value)</Text>
          )}
        </View>

        <View style={styles.paramCard}>
          <Text style={styles.paramCardTitle}>Safety Force Limit (แรงจำกัด)</Text>
          <Text style={styles.paramCardSub}>Machine threshold in Newtons</Text>
          <View style={styles.paramRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMinForce && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustForceN(-FORCE_STEP)}
              disabled={atMinForce}
            >
              <Ionicons name="remove" size={30} color={atMinForce ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.paramValue, { color: theme.primary }]}>{targetForceN} N</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.paramBtn, atMaxForce && styles.paramBtnDisabled, { borderColor: theme.primary }]}
              onPress={() => adjustForceN(FORCE_STEP)}
              disabled={atMaxForce}
            >
              <Ionicons name="add" size={30} color={atMaxForce ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
          </View>
          {customForce && (
            <Text style={styles.customWarningTag}>⚠️ คุณกำลังใช้ค่าที่ต่างจากแพทย์สั่ง (Customized value)</Text>
          )}
        </View>

        {/* Pause / Resume */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={isPaused ? styles.resumeButton : styles.pauseButton}
          onPress={handlePause}
        >
          <Ionicons name={isPaused ? 'play' : 'pause'} size={40} color="#FFFFFF" />
          <Text style={styles.buttonLabel}>
            {isPaused ? 'ทำต่อ (Resume)' : 'หยุดชั่วคราว'}
          </Text>
        </TouchableOpacity>

        {/* Emergency Stop */}
        <TouchableOpacity activeOpacity={0.7} style={styles.emergencyStopButton} onPress={handleEmergencyStop}>
          <Ionicons name="stop-circle" size={40} color="#FFFFFF" />
          <Text style={styles.buttonLabel}>หยุดฉุกเฉิน</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  preparationScroll: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  preparationIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  preparationTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  preparationMessage: {
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  preparationSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  manualWarningBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  manualWarningText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  planCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  planLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  planValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  planNote: {
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    padding: 16,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
  },
  emergencyStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    padding: 20,
    borderRadius: 16,
    marginVertical: 8,
    marginTop: 24,
    width: '100%',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  painQuestionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  painQuestionSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  painLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  painLevelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  painLevelBtnSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  painLevelEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  painLevelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  finishedContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  finishedIconWrap: {
    marginBottom: 24,
  },
  finishedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  finishedSub: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    backgroundColor: '#F8FAFC',
  },
  modeHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  modeHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeHeaderSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  modeHeaderWarning: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pausedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  pausedBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  timerLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 2,
  },
  timerHint: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  warmUpBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warmUpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
  },
  statusBadgeWrap: {
    marginBottom: 20,
  },
  statusBadgeSuccess: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeIcon: {
    marginRight: 8,
  },
  statusBadgeSuccessText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    textAlign: 'center',
  },
  statusBadgeWarning: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statusBadgeWarningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
  },
  safetyForceBanner: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  safetyForceBannerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  paramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  customWarningTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
    marginTop: 10,
    textAlign: 'center',
  },
  paramCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  paramCardSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paramBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  paramBtnDisabled: {
    opacity: 0.5,
    borderColor: '#9CA3AF',
  },
  paramValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3B82F6',
  },
  paramValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
  },
  paramUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
  bottomSpacer: { height: 24 },
});
