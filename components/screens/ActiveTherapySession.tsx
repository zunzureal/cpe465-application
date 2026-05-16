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
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircularTimer } from '@/components/ui/CircularTimer';
import { DSColors, DSShape, DSTypography } from '@/constants/design-system';
import { useDevicePaired } from '@/contexts/DevicePairedContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  sendSessionComplete,
  sendSessionParametersUpdate,
  sendSessionPause,
  sendSessionRestart,
  sendSessionResume,
  sendStartCommand,
} from '@/services/deviceService';
import {
  getPatientPreset,
  getPatientTodayStats,
  submitSession,
  type TodayStatsResponse,
  type TreatmentPlanResponse,
} from '@/services/apiClient';

const IMG_KNEE = require('@/assets/images/knee.png');

// ─── Types ───────────────────────────────────────────────────────────────
type SessionState = 'PREPARATION' | 'RUNNING' | 'PAUSED' | 'FINISHED';

interface TodayStats {
  sessionsCompleted: number;
  totalSessionsTarget: number;
  totalMinutes: number;
  maxFlexion: number;
  targetFlexion: number;
}

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

// Unified DS theme — both doctor and manual modes use University Red palette.
// Manual-mode emphasis is conveyed via DSColors.warning for the safety banner only.
const THEME_DOCTOR = {
  primary: DSColors.primary,
  primaryLight: DSColors.primaryLight,
  success: DSColors.success,
  successBg: DSColors.successLight,
};
const THEME_MANUAL = {
  primary: DSColors.primary,
  primaryLight: DSColors.primaryLight,
  success: DSColors.success,
  successBg: DSColors.successLight,
};

export interface ActiveTherapySessionProps {
  /** When true, manual free practice (orange theme, editable, warning). When false, doctor's plan (blue/green, read-only). */
  isManualMode?: boolean;
}

export function ActiveTherapySession({ isManualMode = false }: ActiveTherapySessionProps) {
  const router = useRouter();
  const { patientId } = useAuth();
  const theme = isManualMode ? THEME_MANUAL : THEME_DOCTOR;
  const { clearDevicePaired, markDevicePaired } = useDevicePaired();

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

  // Today's aggregated stats (fetched once on mount)
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);

  // Mock device tracker state
  const [deviceConnected] = useState(true);
  const [signalStrength] = useState<'good' | 'fair' | 'poor'>('good');

  // Mock IoT link-loss demo (professor-facing)
  const [deviceLostStage, setDeviceLostStage] = useState<'none' | 'error' | 'reconnecting'>('none');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draft text for editable TextInput fields (sync'd from numeric state via useEffect)
  const [flexionText, setFlexionText] = useState(String(isManualMode ? 45 : 90));
  const [extensionText, setExtensionText] = useState('0');
  const [speedText, setSpeedText] = useState(String(isManualMode ? 2 : 3));
  const [forceText, setForceText] = useState(String(isManualMode ? 30 : 10));

  // For FINISHED summary and session result POST
  const timeCompletedRef = useRef(0);
  const maxFlexionRef = useRef(presets.flexionDegree);
  const actualMaxForceNRef = useRef(presets.targetForceN);
  const targetFlexionRef = useRef(targetFlexion);
  const targetForceNRef = useRef(targetForceN);
  const targetExtensionRef = useRef(targetExtension);
  const targetSpeedRef = useRef(targetSpeed);
  const timeLeftRef = useRef(timeLeft);
  targetFlexionRef.current = targetFlexion;
  targetForceNRef.current = targetForceN;
  targetExtensionRef.current = targetExtension;
  targetSpeedRef.current = targetSpeed;
  timeLeftRef.current = timeLeft;
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

    if (!patientId) {
      setPresetError('No patient ID available');
      setLoadingPresets(false);
      return;
    }

    let cancelled = false;
    setLoadingPresets(true);
    setPresetError(null);

    getPatientPreset(patientId)
      .then((response) => {
        if (cancelled) return;

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch presets');
        }

        const data = response.data as TreatmentPlanResponse;
        const presetsFromApi: DoctorPresets = {
          flexionDegree: Number(data.targetFlexion ?? DEFAULT_PRESETS.flexionDegree),
          extensionDegree: Number(data.targetExtension ?? DEFAULT_PRESETS.extensionDegree),
          speed: Number(data.speedLevel ?? DEFAULT_PRESETS.speed),
          holdTime: DEFAULT_PRESETS.holdTime,
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
  }, [isManualMode, patientId]);

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
          void sendSessionComplete({
            kind: 'timer_expired',
            timeLeftSeconds: 0,
            targetFlexion: targetFlexionRef.current,
            targetExtension: targetExtensionRef.current,
            targetForceN: targetForceNRef.current,
            speed: targetSpeedRef.current,
            durationMinutes: presets.durationMinutes,
          });
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

  // Fetch today's session summary once on mount
  useEffect(() => {
    if (!patientId) {
      setTodayStats(null);
      return;
    }

    getPatientTodayStats(patientId)
      .then((response) => {
        if (response.success && response.data) {
          setTodayStats(response.data as TodayStats);
        } else {
          console.warn('[ActiveTherapySession] Failed to fetch today stats:', response.error);
          setTodayStats(null);
        }
      })
      .catch((err) => {
        console.warn('[ActiveTherapySession] Today stats fetch error:', err);
        setTodayStats(null);
      });
  }, [patientId]);

  // Keep draft text in sync when numeric values change via stepper buttons
  useEffect(() => { setFlexionText(String(targetFlexion)); }, [targetFlexion]);
  useEffect(() => { setExtensionText(String(targetExtension)); }, [targetExtension]);
  useEffect(() => { setSpeedText(String(targetSpeed)); }, [targetSpeed]);
  useEffect(() => { setForceText(String(targetForceN)); }, [targetForceN]);

  const handleStartSession = useCallback(() => {
    void sendStartCommand({
      angleFlexion: targetFlexion,
      angleExtension: targetExtension,
      speed: targetSpeed,
      forceN: targetForceN,
      durationMinutes: presets.durationMinutes,
      isManualMode,
    });
    setSessionState('RUNNING');
    setTimeLeft(presets.durationMinutes * 60);
    setIsWarmingUp(presets.useWarmUp);
    setPainLevel(null);
    setPostResultStatus('idle');
  }, [
    presets.durationMinutes,
    presets.useWarmUp,
    targetFlexion,
    targetExtension,
    targetSpeed,
    targetForceN,
    isManualMode,
  ]);

  const handleFinishSession = useCallback(() => {
    void sendSessionComplete({
      timeLeftSeconds: timeLeft,
      targetFlexion,
      targetExtension: targetExtensionRef.current,
      targetForceN: targetForceNRef.current,
      speed: targetSpeedRef.current,
      durationMinutes: presets.durationMinutes,
    });
    const durationSeconds = presets.durationMinutes * 60;
    const elapsed = durationSeconds - timeLeft;
    timeCompletedRef.current = elapsed;
    maxFlexionRef.current = targetFlexion;
    actualMaxForceNRef.current = targetForceNRef.current;
    setSessionState('FINISHED');
  }, [timeLeft, targetFlexion, presets.durationMinutes]);

  const handlePause = useCallback(() => {
    setSessionState((s) => {
      if (s === 'RUNNING') {
        void sendSessionPause({
          sessionState: 'PAUSED',
          timeLeftSeconds: timeLeftRef.current,
          angleFlexion: targetFlexionRef.current,
          angleExtension: targetExtensionRef.current,
          speed: targetSpeedRef.current,
          forceN: targetForceNRef.current,
          isManualMode,
        });
        return 'PAUSED';
      }
      if (s === 'PAUSED') {
        void sendSessionResume({
          sessionState: 'RUNNING',
          timeLeftSeconds: timeLeftRef.current,
          angleFlexion: targetFlexionRef.current,
          angleExtension: targetExtensionRef.current,
          speed: targetSpeedRef.current,
          forceN: targetForceNRef.current,
          isManualMode,
        });
        return 'RUNNING';
      }
      return s;
    });
  }, [isManualMode]);

  const handleReset = useCallback(() => {
    const full = presets.durationMinutes * 60;
    void sendSessionRestart({
      sessionState: 'RUNNING',
      timeLeftSeconds: full,
      angleFlexion: targetFlexionRef.current,
      angleExtension: targetExtensionRef.current,
      speed: targetSpeedRef.current,
      forceN: targetForceNRef.current,
      isManualMode,
      durationMinutes: presets.durationMinutes,
    });
    setTimeLeft(full);
    setSessionState('RUNNING');
  }, [presets.durationMinutes, isManualMode]);

  // Debounced sync of treatment parameters to mock hardware while session is active.
  useEffect(() => {
    if (sessionStateRef.current !== 'RUNNING' && sessionStateRef.current !== 'PAUSED') return;
    const t = setTimeout(() => {
      if (sessionStateRef.current !== 'RUNNING' && sessionStateRef.current !== 'PAUSED') return;
      void sendSessionParametersUpdate({
        sessionState: sessionStateRef.current === 'PAUSED' ? 'PAUSED' : 'RUNNING',
        timeLeftSeconds: timeLeftRef.current,
        angleFlexion: targetFlexionRef.current,
        angleExtension: targetExtensionRef.current,
        speed: targetSpeedRef.current,
        forceN: targetForceNRef.current,
        isManualMode,
      });
    }, 450);
    return () => clearTimeout(t);
  }, [targetFlexion, targetExtension, targetSpeed, targetForceN, isManualMode]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  const handleSimulateDisconnect = useCallback(() => {
    if (deviceLostStage !== 'none') return;
    if (sessionState !== 'RUNNING' && sessionState !== 'PAUSED') return;
    setSessionState('PAUSED');
    setDeviceLostStage('error');
    void clearDevicePaired();
  }, [sessionState, deviceLostStage, clearDevicePaired]);

  const handleReconnectDevice = useCallback(() => {
    setDeviceLostStage('reconnecting');
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      setDeviceLostStage('none');
      setSessionState('RUNNING');
      void markDevicePaired();
    }, 2000);
  }, [markDevicePaired]);

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
    if (!patientId) {
      setPostResultStatus('error');
      Alert.alert(
        'ส่งผลไม่สำเร็จ',
        'ไม่มี ID ผู้ป่วย กรุณาเข้าสู่ระบบใหม่',
        [{ text: 'ตกลง' }]
      );
      return;
    }

    setPostResultStatus('pending');
    const completed = timeCompletedRef.current;
    const actualMaxFlexion = maxFlexionRef.current;
    const actualMaxForceN = actualMaxForceNRef.current;

    const payload = {
      patientId,
      planId: activePlanId,
      sessionDate: new Date().toISOString(),
      actualMaxFlexion,
      durationCompleted: completed,
      painLevel,
      isCustomUsed: isCustomSettings,
      actualMaxForceN,
    };

    try {
      const response = await submitSession(payload);
      if (response.success) {
        setPostResultStatus('success');
      } else {
        throw new Error(response.error || 'Failed to submit session');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setPostResultStatus('error');
      Alert.alert(
        'ส่งผลไม่สำเร็จ',
        'ไม่สามารถส่งผลเซสชันได้ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง\n\n' + message,
        [{ text: 'ตกลง' }]
      );
    }
  }, [painLevel, isCustomSettings, activePlanId, patientId]);

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
          {/* Knee image hero */}
          <View style={styles.kneeImageWrap}>
            <Image source={IMG_KNEE} style={styles.kneeImage} resizeMode="contain" />
          </View>

          <Text style={styles.preparationTitle}>เตรียมพร้อมก่อนเริ่ม</Text>
          <Text style={styles.preparationMessage}>
            กรุณาวางขาลงบนเครื่องและรัดสายให้เรียบร้อย
          </Text>
          <Text style={styles.preparationSub}>Please place your leg on the machine and secure the straps.</Text>

          {isManualMode && (
            <View style={[styles.manualWarningBanner, { backgroundColor: DSColors.warningLight, borderColor: DSColors.warning }]}>
              <Ionicons name="warning-outline" size={18} color={DSColors.warning} />
              <Text style={[styles.manualWarningText, { color: DSColors.warning }]}>
                อย่าฝืนทำหากรู้สึกเจ็บปวด
              </Text>
            </View>
          )}

          <View style={styles.planCard}>
            {/* Plan header */}
            <View style={styles.planHeader}>
              <Ionicons
                name={isManualMode ? 'person-circle-outline' : 'medical-outline'}
                size={22}
                color={DSColors.primary}
              />
              <Text style={styles.planTitle}>
                {isManualMode ? 'โหมดฝึกอิสระ' : 'สรุปแผนวันนี้'}
              </Text>
              {!isManualMode && todayStats && (
                <View style={styles.planSessionBadge}>
                  <Text style={styles.planSessionBadgeText}>
                    กำลังทำครั้งที่ {todayStats.sessionsCompleted + 1} / {todayStats.totalSessionsTarget}
                  </Text>
                </View>
              )}
            </View>

            {/* Session progress dots */}
            {!isManualMode && todayStats && (
              <View style={styles.planSessionDots}>
                {Array.from({ length: todayStats.totalSessionsTarget }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.planSessionDot,
                      i < todayStats.sessionsCompleted
                        ? styles.planSessionDotDone
                        : i === todayStats.sessionsCompleted
                        ? styles.planSessionDotCurrent
                        : styles.planSessionDotEmpty,
                    ]}
                  />
                ))}
              </View>
            )}

            <Text style={styles.planSubtitle}>
              {isManualMode
                ? 'ฝึกเพิ่มเติมตามความเหมาะสม'
                : 'ปฏิบัติตามคำสั่งแพทย์'}
            </Text>

            {/* Parameter rows with icons */}
            <View style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="trending-up" size={18} color={DSColors.primary} />
                </View>
                <Text style={styles.planLabel}>งอเข่าสูงสุด</Text>
              </View>
              <Text style={styles.planValue}>{presets.flexionDegree}°</Text>
            </View>

            <View style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="remove-circle-outline" size={18} color={DSColors.primary} />
                </View>
                <Text style={styles.planLabel}>เหยียดขา</Text>
              </View>
              <Text style={styles.planValue}>{presets.extensionDegree}°</Text>
            </View>

            <View style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="speedometer-outline" size={18} color={DSColors.primary} />
                </View>
                <Text style={styles.planLabel}>ความเร็ว</Text>
              </View>
              <Text style={styles.planValue}>ระดับ {presets.speed}</Text>
            </View>

            <View style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="pause-circle-outline" size={18} color={DSColors.primary} />
                </View>
                <Text style={styles.planLabel}>คงค้างที่จุดสิ้นสุด</Text>
              </View>
              <Text style={styles.planValue}>{presets.holdTime} วิ</Text>
            </View>

            <View style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="time-outline" size={18} color={DSColors.primary} />
                </View>
                <Text style={styles.planLabel}>ระยะเวลา</Text>
              </View>
              <Text style={styles.planValue}>{presets.durationMinutes} นาที</Text>
            </View>

            <View style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={DSColors.primary} />
                </View>
                <Text style={styles.planLabel}>แรงจำกัด (Safety)</Text>
              </View>
              <Text style={styles.planValue}>{presets.targetForceN} N</Text>
            </View>

            {presets.useWarmUp && (
              <View style={styles.warmUpNote}>
                <Ionicons name="flame-outline" size={15} color={DSColors.warning} />
                <Text style={styles.planNote}>รวมช่วงวอร์มอัพข้อต่อ</Text>
              </View>
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
  const isPaused = sessionState === 'PAUSED' || deviceLostStage !== 'none';
  const sessionActionsLocked = deviceLostStage !== 'none';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.sessionRoot}>
        <TouchableOpacity
          style={styles.simulateDisconnectBtn}
          onPress={handleSimulateDisconnect}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="จำลองอุปกรณ์หลุด"
        >
          <View style={styles.wifiSlashWrap}>
            <Ionicons name="wifi-outline" size={18} color={DSColors.text.secondary} />
            <View style={styles.wifiSlashLine} />
          </View>
          <Text style={styles.simulateDisconnectText} numberOfLines={1}>
            จำลองอุปกรณ์หลุด
          </Text>
        </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Row 1: compact mode chip */}
        <View style={[styles.modeChip, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '60' }]}>
          <Ionicons
            name={isManualMode ? 'person-outline' : 'medical-outline'}
            size={16}
            color={theme.primary}
          />
          <Text style={[styles.modeChipText, { color: theme.primary }]}>
            {isManualMode ? 'โหมดฝึกอิสระ' : 'การรักษาประจำวัน'}
          </Text>
          {isManualMode && (
            <>
              <View style={styles.modeChipSep} />
              <Ionicons name="warning-outline" size={14} color={DSColors.warning} />
              <Text style={styles.modeChipWarn}>อย่าฝืนทำหากเจ็บปวด</Text>
            </>
          )}
        </View>

        {/* Timer – circular progress ring */}
        <View style={styles.timerSection}>
          <CircularTimer
            timeLeft={timeLeft}
            totalSeconds={presets.durationMinutes * 60}
            isPaused={isPaused}
            size={200}
            strokeWidth={12}
          />
        </View>

        {/* Warm-up badge */}
        {isWarmingUp && sessionState === 'RUNNING' && (
          <Animated.View style={[styles.warmUpBadge, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="flame-outline" size={16} color={DSColors.warning} />
            <Text style={styles.warmUpText}>วอร์มอัพข้อต่ออยู่…</Text>
          </Animated.View>
        )}

        {/* Row 2: status chip + force chip side-by-side */}
        <View style={styles.infoChipsRow}>
          {/* Status chip */}
          {isManualMode ? (
            <View style={[styles.infoChip, styles.infoChipPrimary]}>
              <Ionicons name="person-outline" size={15} color={theme.primary} />
              <Text style={[styles.infoChipText, { color: theme.primary }]}>โหมดอิสระ</Text>
            </View>
          ) : isCustomSettings ? (
            <View style={[styles.infoChip, styles.infoChipWarn]}>
              <Ionicons name="create-outline" size={15} color={DSColors.warning} />
              <Text style={[styles.infoChipText, { color: DSColors.warning }]}>ค่าที่ปรับเอง</Text>
            </View>
          ) : (
            <View style={[styles.infoChip, styles.infoChipSuccess]}>
              <Ionicons name="checkmark-circle" size={15} color={DSColors.success} />
              <Text style={[styles.infoChipText, { color: DSColors.success }]}>ตามแผนหมอ</Text>
            </View>
          )}

          {/* Force chip */}
          <View style={[styles.infoChip, styles.infoChipPrimary]}>
            <Ionicons name="shield-checkmark-outline" size={15} color={DSColors.primary} />
            <Text style={[styles.infoChipText, { color: DSColors.primary }]}>แรงจำกัด {targetForceN} N</Text>
          </View>
        </View>

        {/* Today's session summary card — 4 GoalChip columns in one row */}
        {todayStats && (
          <View style={styles.todayStatsCard}>
            <View style={styles.todayStatsHeader}>
              <Ionicons name="today-outline" size={18} color={DSColors.primary} />
              <Text style={styles.todayStatsTitle}>วันนี้ทำไปแล้ว</Text>
            </View>

            <View style={styles.todayChipRow}>
              {/* 1 — Sessions as pips */}
              <View style={styles.todayChip}>
                <View style={styles.todayChipIconWrap}>
                  <Ionicons name="repeat-outline" size={22} color={DSColors.primary} />
                </View>
                <Text style={styles.todayChipLabel}>ครั้งที่ทำ</Text>
                <View style={styles.sessionPipRow}>
                  {Array.from({ length: todayStats.totalSessionsTarget }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.sessionPipDot,
                        i < todayStats.sessionsCompleted ? styles.sessionPipDotDone : styles.sessionPipDotEmpty,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.todayChipDivider} />

              {/* 2 — Time */}
              <View style={styles.todayChip}>
                <View style={styles.todayChipIconWrap}>
                  <Ionicons name="time-outline" size={22} color={DSColors.primary} />
                </View>
                <Text style={styles.todayChipLabel}>เวลารวม</Text>
                <Text style={styles.todayChipValue}>{todayStats.totalMinutes} นาที</Text>
              </View>

              <View style={styles.todayChipDivider} />

              {/* 3 — Max flexion */}
              <View style={styles.todayChip}>
                <View style={[styles.todayChipIconWrap, { backgroundColor: DSColors.successLight }]}>
                  <Ionicons name="trending-up" size={22} color={DSColors.success} />
                </View>
                <Text style={styles.todayChipLabel}>มุมสูงสุด</Text>
                <Text style={[styles.todayChipValue, { color: DSColors.success }]}>{todayStats.maxFlexion}°</Text>
              </View>

              <View style={styles.todayChipDivider} />

              {/* 4 — Target */}
              <View style={styles.todayChip}>
                <View style={styles.todayChipIconWrap}>
                  <Ionicons name="flag-outline" size={22} color={DSColors.primary} />
                </View>
                <Text style={styles.todayChipLabel}>เป้าหมาย</Text>
                <Text style={styles.todayChipValue}>{todayStats.targetFlexion}°</Text>
              </View>
            </View>
          </View>
        )}

        {/* Parameter cards – label left / [−] value [+] stepper right */}

        {/* Flexion */}
        <View style={styles.paramCard}>
          <View style={styles.paramRow}>
            <View style={styles.paramLabelGroup}>
              <View style={styles.paramIconWrap}>
                <Ionicons name="trending-up" size={18} color={DSColors.primary} />
              </View>
              <View style={styles.paramLabelText}>
                <Text style={styles.paramCardTitle}>งอเข่า</Text>
                <Text style={styles.paramCardSub}>เป้าหมายองศาสูงสุด</Text>
              </View>
            </View>
            {/* Centered absolutely so it's always at X-midpoint of the card */}
            <View style={styles.paramWarnSlot} pointerEvents="none">
              <View style={[styles.paramWarnInner, { opacity: customFlexion ? 1 : 0 }]}>
                <View style={styles.paramWarnIconWrap}>
                  <Ionicons name="alert-circle" size={22} color={DSColors.warning} />
                </View>
                <Text style={styles.paramWarnLabel} numberOfLines={1}>ปรับค่า</Text>
              </View>
            </View>
            <View style={styles.paramStepper}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMinFlexion && styles.paramStepBtnDisabled]} onPress={() => adjustFlexion(-5)} disabled={atMinFlexion}>
                <Ionicons name="remove" size={22} color={atMinFlexion ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
              <View style={styles.paramValueArea}>
                <TextInput style={styles.paramValueInput} value={flexionText} onChangeText={setFlexionText} keyboardType="numeric" selectTextOnFocus maxLength={4} returnKeyType="done"
                  onBlur={() => { const n = parseInt(flexionText, 10); if (!isNaN(n)) { const c = Math.max(FLEXION_MIN, Math.min(FLEXION_MAX, n)); setTargetFlexion(c); if (!isManualMode && c !== presets.flexionDegree) setIsCustomSettings(true); } else setFlexionText(String(targetFlexion)); }}
                  onSubmitEditing={() => { const n = parseInt(flexionText, 10); if (!isNaN(n)) { const c = Math.max(FLEXION_MIN, Math.min(FLEXION_MAX, n)); setTargetFlexion(c); if (!isManualMode && c !== presets.flexionDegree) setIsCustomSettings(true); } else setFlexionText(String(targetFlexion)); }}
                />
                <Text style={styles.paramUnitText}>°</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMaxFlexion && styles.paramStepBtnDisabled]} onPress={() => adjustFlexion(5)} disabled={atMaxFlexion}>
                <Ionicons name="add" size={22} color={atMaxFlexion ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Extension */}
        <View style={styles.paramCard}>
          <View style={styles.paramRow}>
            <View style={styles.paramLabelGroup}>
              <View style={styles.paramIconWrap}>
                <Ionicons name="remove-circle-outline" size={18} color={DSColors.primary} />
              </View>
              <View style={styles.paramLabelText}>
                <Text style={styles.paramCardTitle}>เหยียดขา</Text>
                <Text style={styles.paramCardSub}>เป้าหมายองศาต่ำสุด</Text>
              </View>
            </View>
            <View style={styles.paramWarnSlot} pointerEvents="none">
              <View style={[styles.paramWarnInner, { opacity: customExtension ? 1 : 0 }]}>
                <View style={styles.paramWarnIconWrap}>
                  <Ionicons name="alert-circle" size={22} color={DSColors.warning} />
                </View>
                <Text style={styles.paramWarnLabel} numberOfLines={1}>ปรับค่า</Text>
              </View>
            </View>
            <View style={styles.paramStepper}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMinExtension && styles.paramStepBtnDisabled]} onPress={() => adjustExtension(-5)} disabled={atMinExtension}>
                <Ionicons name="remove" size={22} color={atMinExtension ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
              <View style={styles.paramValueArea}>
                <TextInput style={styles.paramValueInput} value={extensionText} onChangeText={setExtensionText} keyboardType="numeric" selectTextOnFocus maxLength={4} returnKeyType="done"
                  onBlur={() => { const n = parseInt(extensionText, 10); if (!isNaN(n)) { const c = Math.max(EXTENSION_MIN, Math.min(EXTENSION_MAX, n)); setTargetExtension(c); if (!isManualMode && c !== presets.extensionDegree) setIsCustomSettings(true); } else setExtensionText(String(targetExtension)); }}
                  onSubmitEditing={() => { const n = parseInt(extensionText, 10); if (!isNaN(n)) { const c = Math.max(EXTENSION_MIN, Math.min(EXTENSION_MAX, n)); setTargetExtension(c); if (!isManualMode && c !== presets.extensionDegree) setIsCustomSettings(true); } else setExtensionText(String(targetExtension)); }}
                />
                <Text style={styles.paramUnitText}>°</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMaxExtension && styles.paramStepBtnDisabled]} onPress={() => adjustExtension(5)} disabled={atMaxExtension}>
                <Ionicons name="add" size={22} color={atMaxExtension ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Speed */}
        <View style={styles.paramCard}>
          <View style={styles.paramRow}>
            <View style={styles.paramLabelGroup}>
              <View style={styles.paramIconWrap}>
                <Ionicons name="speedometer-outline" size={18} color={DSColors.primary} />
              </View>
              <View style={styles.paramLabelText}>
                <Text style={styles.paramCardTitle}>ความเร็ว</Text>
                <Text style={styles.paramCardSub}>ระดับ 1–5</Text>
              </View>
            </View>
            <View style={styles.paramWarnSlot} pointerEvents="none">
              <View style={[styles.paramWarnInner, { opacity: customSpeed ? 1 : 0 }]}>
                <View style={styles.paramWarnIconWrap}>
                  <Ionicons name="alert-circle" size={22} color={DSColors.warning} />
                </View>
                <Text style={styles.paramWarnLabel} numberOfLines={1}>ปรับค่า</Text>
              </View>
            </View>
            <View style={styles.paramStepper}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMinSpeed && styles.paramStepBtnDisabled]} onPress={() => adjustSpeed(-1)} disabled={atMinSpeed}>
                <Ionicons name="remove" size={22} color={atMinSpeed ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
              <View style={styles.paramValueArea}>
                <TextInput style={styles.paramValueInput} value={speedText} onChangeText={setSpeedText} keyboardType="numeric" selectTextOnFocus maxLength={1} returnKeyType="done"
                  onBlur={() => { const n = parseInt(speedText, 10); if (!isNaN(n)) { const c = Math.max(SPEED_MIN, Math.min(SPEED_MAX, n)); setTargetSpeed(c); if (!isManualMode && c !== presets.speed) setIsCustomSettings(true); } else setSpeedText(String(targetSpeed)); }}
                  onSubmitEditing={() => { const n = parseInt(speedText, 10); if (!isNaN(n)) { const c = Math.max(SPEED_MIN, Math.min(SPEED_MAX, n)); setTargetSpeed(c); if (!isManualMode && c !== presets.speed) setIsCustomSettings(true); } else setSpeedText(String(targetSpeed)); }}
                />
                <Text style={styles.paramUnitText}>lv.</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMaxSpeed && styles.paramStepBtnDisabled]} onPress={() => adjustSpeed(1)} disabled={atMaxSpeed}>
                <Ionicons name="add" size={22} color={atMaxSpeed ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Force Limit */}
        <View style={styles.paramCard}>
          <View style={styles.paramRow}>
            <View style={styles.paramLabelGroup}>
              <View style={styles.paramIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={18} color={DSColors.primary} />
              </View>
              <View style={styles.paramLabelText}>
                <Text style={styles.paramCardTitle}>แรงจำกัด</Text>
                <Text style={styles.paramCardSub}>Safety limit (N)</Text>
              </View>
            </View>
            <View style={styles.paramWarnSlot} pointerEvents="none">
              <View style={[styles.paramWarnInner, { opacity: customForce ? 1 : 0 }]}>
                <View style={styles.paramWarnIconWrap}>
                  <Ionicons name="alert-circle" size={22} color={DSColors.warning} />
                </View>
                <Text style={styles.paramWarnLabel} numberOfLines={1}>ปรับค่า</Text>
              </View>
            </View>
            <View style={styles.paramStepper}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMinForce && styles.paramStepBtnDisabled]} onPress={() => adjustForceN(-FORCE_STEP)} disabled={atMinForce}>
                <Ionicons name="remove" size={22} color={atMinForce ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
              <View style={styles.paramValueArea}>
                <TextInput style={styles.paramValueInput} value={forceText} onChangeText={setForceText} keyboardType="numeric" selectTextOnFocus maxLength={4} returnKeyType="done"
                  onBlur={() => { const n = parseInt(forceText, 10); if (!isNaN(n)) { const c = Math.max(FORCE_MIN, Math.min(FORCE_MAX, n)); setTargetForceN(c); if (!isManualMode && c !== presets.targetForceN) setIsCustomSettings(true); } else setForceText(String(targetForceN)); }}
                  onSubmitEditing={() => { const n = parseInt(forceText, 10); if (!isNaN(n)) { const c = Math.max(FORCE_MIN, Math.min(FORCE_MAX, n)); setTargetForceN(c); if (!isManualMode && c !== presets.targetForceN) setIsCustomSettings(true); } else setForceText(String(targetForceN)); }}
                />
                <Text style={styles.paramUnitText}>N</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} style={[styles.paramStepBtn, atMaxForce && styles.paramStepBtnDisabled]} onPress={() => adjustForceN(FORCE_STEP)} disabled={atMaxForce}>
                <Ionicons name="add" size={22} color={atMaxForce ? '#C4C4C4' : DSColors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* ─── Fixed bottom bar ──────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {/* Device tracker status strip */}
        <View style={styles.deviceStatusBar}>
          <View style={styles.deviceStatusLeft}>
            <View style={[styles.deviceDot, deviceConnected ? styles.deviceDotOn : styles.deviceDotOff]} />
            <Text style={[styles.deviceStatusText, { color: deviceConnected ? DSColors.success : DSColors.danger }]}>
              {deviceConnected ? 'เซ็นเซอร์เชื่อมต่ออยู่' : 'ไม่พบเซ็นเซอร์'}
            </Text>
          </View>
          <View style={styles.deviceStatusRight}>
            <Text style={[styles.deviceSignalText, {
              color: signalStrength === 'good' ? DSColors.success : signalStrength === 'fair' ? DSColors.warning : DSColors.danger,
            }]}>
              {signalStrength === 'good' ? 'สัญญาณดี' : signalStrength === 'fair' ? 'สัญญาณปานกลาง' : 'สัญญาณอ่อน'}
            </Text>
            <Ionicons
              name={signalStrength === 'good' ? 'cellular' : signalStrength === 'fair' ? 'cellular-outline' : 'wifi-outline'}
              size={14}
              color={signalStrength === 'good' ? DSColors.success : signalStrength === 'fair' ? DSColors.warning : DSColors.danger}
            />
          </View>
        </View>

        {/* 3-button action row */}
        <View style={styles.bottomBtnRow}>
          {/* Pause / Resume */}
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.bottomBtnOutline, isPaused && styles.bottomBtnOutlinePaused]}
            onPress={handlePause}
            disabled={sessionActionsLocked}
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={20} color={isPaused ? DSColors.success : DSColors.primary} />
            <Text style={[styles.bottomBtnOutlineLabel, isPaused && { color: DSColors.success }]}>
              {isPaused ? 'ทำต่อ' : 'หยุดชั่วคราว'}
            </Text>
            <Text style={styles.bottomBtnSub}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>

          {/* Reset */}
          <TouchableOpacity activeOpacity={0.75} style={styles.bottomBtnOutline} onPress={handleReset} disabled={sessionActionsLocked}>
            <Ionicons name="refresh-outline" size={20} color={DSColors.text.secondary} />
            <Text style={[styles.bottomBtnOutlineLabel, { color: DSColors.text.secondary }]}>เริ่มใหม่</Text>
            <Text style={styles.bottomBtnSub}>Reset</Text>
          </TouchableOpacity>

          {/* Finish session */}
          <TouchableOpacity activeOpacity={0.75} style={styles.bottomBtnFinish} onPress={handleFinishSession} disabled={sessionActionsLocked}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.bottomBtnFinishLabel}>เสร็จสิ้นการฝึก</Text>
            <Text style={[styles.bottomBtnSub, { color: 'rgba(255,255,255,0.75)' }]}>Finish Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>

      <Modal
        visible={deviceLostStage !== 'none'}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.deviceLostBackdrop} pointerEvents="box-none">
          <View style={styles.deviceLostSheet}>
            {deviceLostStage === 'reconnecting' ? (
              <>
                <ActivityIndicator size="large" color={DSColors.primary} />
                <Text style={styles.deviceLostTitle}>กำลังเชื่อมต่อใหม่...</Text>
                <Text style={styles.deviceLostSub}>Reconnecting to device...</Text>
              </>
            ) : (
              <>
                <View style={styles.deviceLostIconWrap}>
                  <Ionicons name="warning" size={56} color={DSColors.danger} />
                </View>
                <Text style={styles.deviceLostTitle}>
                  ข้อผิดพลาด: ขาดการเชื่อมต่อกับอุปกรณ์!
                </Text>
                <Text style={styles.deviceLostSub}>Error: Device connection lost</Text>
                <TouchableOpacity
                  style={styles.reconnectBtn}
                  onPress={handleReconnectDevice}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="ลองเชื่อมต่อใหม่"
                >
                  <Text style={styles.reconnectBtnText}>ลองเชื่อมต่อใหม่</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  sessionRoot: {
    flex: 1,
  },
  simulateDisconnectBtn: {
    position: 'absolute',
    top: 6,
    right: 10,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusChip,
    borderWidth: 1,
    borderColor: DSColors.borderLight,
    maxWidth: 220,
  },
  wifiSlashWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiSlashLine: {
    position: 'absolute',
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: DSColors.danger,
    transform: [{ rotate: '-42deg' }],
  },
  simulateDisconnectText: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  deviceLostBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deviceLostSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DSColors.danger + '55',
  },
  deviceLostIconWrap: {
    marginBottom: 8,
  },
  deviceLostTitle: {
    ...DSTypography.h3,
    color: DSColors.primaryDark,
    textAlign: 'center',
  },
  deviceLostSub: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  reconnectBtn: {
    marginTop: 24,
    backgroundColor: DSColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: DSShape.radiusButton,
    alignSelf: 'stretch',
  },
  reconnectBtnText: {
    ...DSTypography.bodyBold,
    color: DSColors.text.inverse,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: DSColors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: DSColors.text.secondary,
  },
  preparationScroll: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
    backgroundColor: DSColors.background,
  },
  kneeImageWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  kneeImage: {
    width: 110,
    height: 110,
  },
  preparationTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: DSColors.text.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  preparationMessage: {
    fontSize: 16,
    color: DSColors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  preparationSub: {
    fontSize: 14,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  manualWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  manualWarningText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  planCard: {
    width: '100%',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 20,
    marginBottom: 28,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DSColors.text.primary,
    flex: 1,
  },
  planSessionBadge: {
    backgroundColor: DSColors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  planSessionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: DSColors.text.secondary,
  },
  planSessionDots: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 30,
    marginBottom: 8,
  },
  planSessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planSessionDotDone: {
    backgroundColor: DSColors.success,
  },
  planSessionDotCurrent: {
    backgroundColor: DSColors.border,
    borderWidth: 1.5,
    borderColor: DSColors.text.secondary,
  },
  planSessionDotEmpty: {
    backgroundColor: DSColors.borderLight,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  planSubtitle: {
    fontSize: 13,
    color: DSColors.text.secondary,
    marginBottom: 16,
    marginLeft: 30,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  planRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  planIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    fontSize: 15,
    color: DSColors.text.primary,
    flex: 1,
  },
  planValue: {
    fontSize: 16,
    fontWeight: '700',
    color: DSColors.primary,
  },
  warmUpNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  planNote: {
    fontSize: 14,
    color: DSColors.warning,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primary,
    padding: 16,
    borderRadius: DSShape.radiusButton,
    marginVertical: 8,
    width: '100%',
    minHeight: 56,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.secondary,
    padding: 16,
    borderRadius: DSShape.radiusButton,
    marginVertical: 8,
    width: '100%',
    minHeight: 56,
  },
  buttonLabel: {
    color: DSColors.text.inverse,
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
    color: DSColors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  painQuestionSub: {
    fontSize: 14,
    color: DSColors.text.secondary,
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
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    borderWidth: 2,
    borderColor: DSColors.border,
  },
  painLevelBtnSelected: {
    borderColor: DSColors.primary,
    backgroundColor: DSColors.primaryLight,
  },
  painLevelEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  painLevelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DSColors.text.primary,
  },
  finishedContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.background,
  },
  finishedIconWrap: {
    marginBottom: 24,
  },
  finishedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DSColors.text.primary,
    marginBottom: 8,
  },
  finishedSub: {
    fontSize: 16,
    color: DSColors.text.secondary,
    marginBottom: 32,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 20,
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: DSColors.text.primary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  summaryLabel: {
    fontSize: 16,
    color: DSColors.text.secondary,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: DSColors.text.primary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    backgroundColor: DSColors.background,
  },
  // ─── Compact mode chip (row 1) ───────────────────────────────────────────
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeChipSep: {
    width: 1,
    height: 12,
    backgroundColor: DSColors.border,
    marginHorizontal: 2,
  },
  modeChipWarn: {
    fontSize: 12,
    fontWeight: '500',
    color: DSColors.warning,
  },
  // ─── Status + Force chips row (row 2) ────────────────────────────────────
  infoChipsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoChipPrimary: {
    backgroundColor: DSColors.primaryLight,
    borderColor: DSColors.primary + '60',
  },
  infoChipSuccess: {
    backgroundColor: DSColors.successLight,
    borderColor: DSColors.success + '60',
  },
  infoChipWarn: {
    backgroundColor: DSColors.warningLight,
    borderColor: DSColors.warning + '60',
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  warmUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: DSColors.warningLight,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DSColors.warning,
  },
  warmUpText: {
    fontSize: 13,
    fontWeight: '600',
    color: DSColors.warning,
  },
  // ─── Today stats card (mirrors home GoalChip style) ─────────────────────
  todayStatsCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DSColors.borderLight,
  },
  todayStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  todayStatsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DSColors.text.primary,
  },
  todayPips: { flexDirection: 'row', gap: 5 },
  todayPip: { width: 8, height: 8, borderRadius: 4 },
  todayPipDone: { backgroundColor: DSColors.success },
  todayPipEmpty: { backgroundColor: '#D1D5DB' },
  todayPipLabel: { fontSize: 13, fontWeight: '700', color: DSColors.text.secondary },
  todayChipRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: DSColors.background,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  todayChip: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  todayChipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  todayChipLabel: {
    fontSize: 11,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  todayChipValue: {
    fontSize: 16,
    fontWeight: '800',
    color: DSColors.primary,
    textAlign: 'center',
  },
  todayChipDivider: {
    width: 1,
    backgroundColor: DSColors.border,
    marginVertical: 6,
  },
  sessionPipRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
  },
  sessionPipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sessionPipDotDone: {
    backgroundColor: DSColors.success,
  },
  sessionPipDotEmpty: {
    backgroundColor: '#D1D5DB',
  },
  paramCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    position: 'relative',
  },
  paramLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  paramLabelText: {
    flex: 1,
    minWidth: 0,
  },
  paramIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paramCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DSColors.text.primary,
  },
  paramCardSub: {
    fontSize: 12,
    color: DSColors.text.secondary,
    marginTop: 1,
  },
  paramStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 180,       // fixed so [−] and [+] align across all cards
    flexShrink: 0,
  },
  paramStepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DSColors.primary,
    flexShrink: 0,
  },
  paramStepBtnDisabled: {
    backgroundColor: DSColors.background,
    borderColor: '#D1D5DB',
  },
  paramValueArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,           // value and unit hug each other
  },
  paramValueInput: {
    fontSize: 28,
    fontWeight: '800',
    color: DSColors.primary,
    padding: 0,
    margin: 0,
    textAlign: 'center',
    minWidth: 36,
    includeFontPadding: false,
  },
  paramUnitText: {
    fontSize: 13,
    fontWeight: '600',
    color: DSColors.text.secondary,
    marginLeft: 1,
  },
  paramWarnSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  paramWarnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paramWarnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DSColors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paramWarnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: DSColors.warning,
  },
  // ─── Fixed bottom bar ────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: DSColors.surface,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    gap: 10,
  },
  // Device tracker strip
  deviceStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  deviceStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceDotOn: { backgroundColor: DSColors.success },
  deviceDotOff: { backgroundColor: DSColors.danger },
  deviceStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deviceStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deviceSignalText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // 3-button action row
  bottomBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomBtnOutline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: DSShape.radiusButton,
    borderWidth: 1.5,
    borderColor: DSColors.primary,
    gap: 2,
    backgroundColor: DSColors.primaryLight,
  },
  bottomBtnOutlinePaused: {
    borderColor: DSColors.success,
    backgroundColor: DSColors.successLight,
  },
  bottomBtnOutlineLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: DSColors.primary,
    textAlign: 'center',
  },
  bottomBtnSub: {
    fontSize: 10,
    fontWeight: '400',
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  bottomBtnFinish: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.primary,
    gap: 2,
  },
  bottomBtnFinishLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
