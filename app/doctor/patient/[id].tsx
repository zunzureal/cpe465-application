import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TextInput, Switch, StyleSheet, Pressable, Text, TouchableOpacity, useWindowDimensions, Modal, ScrollView, Platform, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import { DSColors, DSLayout, DSShape, DSShadowSoft, DSTypography } from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { putPatientPreset, getDoctorPatient, getPatientPreset, getPatientSessions, deactivatePlan, type SessionResponse } from '@/services/apiClient';
import { bangkokParts, toBangkokDateKey } from '@/utils/dateUtils';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import DateTimePicker, { useDefaultStyles, type DateType } from 'react-native-calendars-datepicker';

const TARGET_LINE_COLOR = '#7DD3FC';
const ACTUAL_LINE_COLOR = DSColors.primary;

const CHART_WIDTH = Dimensions.get('window').width - DSLayout.screenPadding * 2 - DSLayout.cardPadding * 2;
const CHART_HEIGHT = Math.max(160, Math.min(200, Dimensions.get('window').width * 0.5));

const makeChartConfig = (labelColor: string, gridColor: string) => ({
  backgroundColor: DSColors.surface,
  backgroundGradientFrom: DSColors.surface,
  backgroundGradientTo: DSColors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(160,0,0,${opacity * 0.25})`,
  labelColor: () => labelColor,
  style: { borderRadius: 16 },
  propsForLabels: { fontSize: 13, fontWeight: '600' as const },
  propsForBackgroundLines: { stroke: gridColor, strokeWidth: 0.6 },
  fillShadowGradient: ACTUAL_LINE_COLOR,
  fillShadowGradientOpacity: 0.08,
  propsForDots: { r: '3' },
});

function clampNumber(rawValue: string, minValue: number, maxValue: number) {
  const normalized = rawValue.replace(/[^0-9.-]/g, '');
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return normalized;
  const numericValue = Number(normalized);
  if (Number.isNaN(numericValue)) return '';
  return String(Math.min(maxValue, Math.max(minValue, numericValue)));
}

function sanitizePositiveInteger(rawValue: string, maxDigits: number) {
  return rawValue.replace(/\D/g, '').slice(0, maxDigits);
}

const REALISTIC_LIMITS = {
  flexion: { min: 0, max: 180 },
  extension: { min: -30, max: 30 },
  speed: { min: 1, max: 10 },
  forceLevel: { min: 1, max: 10 },
} as const;

function AndroidTabletProgressFallback({
  sessions,
  targetFlexion,
}: {
  sessions: any[];
  targetFlexion: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const recent = sessions.slice(-7).reverse();
  const targetValue = Number(targetFlexion) || 0;
  const maxValue = Math.max(targetValue, ...recent.map((s) => Number(s?.actualMaxFlexion) || 0), 1);
  const barWidth = Math.max(220, Math.min(520, screenWidth - 64));

  return (
    <View style={styles.androidTabletProgressWrap}>
      <View style={styles.androidTabletProgressHeader}>
        <Text style={styles.androidTabletProgressTitle}>Progress Summary</Text>
        <Text style={styles.androidTabletProgressSubtitle}>Last 7 sessions</Text>
      </View>

      <View style={styles.androidTabletProgressLegend}>
        <View style={styles.androidTabletLegendItem}>
          <View style={[styles.androidTabletLegendDot, { backgroundColor: DSColors.primary }]} />
          <Text style={styles.androidTabletLegendText}>Actual</Text>
        </View>
        <View style={styles.androidTabletLegendItem}>
          <View style={[styles.androidTabletLegendDot, { backgroundColor: '#7DD3FC' }]} />
          <Text style={styles.androidTabletLegendText}>Target</Text>
        </View>
      </View>

      {recent.map((session, index) => {
        const actualValue = Number(session?.actualMaxFlexion) || 0;
        const sessionDate = new Date(session?.sessionDate);
        const p = bangkokParts(sessionDate);
        const label = `${p.month0 + 1}/${p.day}`;
        const actualWidth = Math.max(6, (actualValue / maxValue) * barWidth);
        const targetWidth = Math.max(6, (targetValue / maxValue) * barWidth);

        return (
          <View key={String(session?.id ?? index)} style={styles.androidTabletProgressCard}>
            <View style={styles.androidTabletProgressRowTop}>
              <Text style={styles.androidTabletProgressDate}>{label}</Text>
              <Text style={styles.androidTabletProgressValue}>Actual {Math.round(actualValue)}° / Target {Math.round(targetValue)}°</Text>
            </View>

            <View style={styles.androidTabletProgressTrack}>
              <View style={[styles.androidTabletProgressTarget, { width: targetWidth }]} />
              <View style={[styles.androidTabletProgressActual, { width: actualWidth }]} />
            </View>

            <Text style={styles.androidTabletProgressInfo}>
              {actualValue >= targetValue ? 'Reached target' : 'Below target'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ManagePatientScreen({ patientIdProp, embedded = false, onClose }: { patientIdProp?: number; embedded?: boolean; onClose?: () => void } = {}) {
  const params = useLocalSearchParams();
  const routeId = params?.id;
  const patientId = typeof patientIdProp === 'number' ? patientIdProp : Number(routeId);
  const { authToken } = useAuth();
  const { width } = useWindowDimensions();
  const isNarrow = width < 600;
  const isAndroidTablet = Platform.OS === 'android' && width >= 768;
  const effectiveEmbedded = embedded && !isAndroidTablet;
  const isCompactEmbedded = embedded && isNarrow;
  const [showRangePicker, setShowRangePicker] = useState(false);

  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');
  const [sessionsPerDay, setSessionsPerDay] = useState('1');
  const [daysOfWeek, setDaysOfWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [patientHn, setPatientHn] = useState<string | null>(null);
  // Preset fields
  const [targetFlexion, setTargetFlexion] = useState<string>('120');
  const [targetExtension, setTargetExtension] = useState<string>('0');
  const [speedLevel, setSpeedLevel] = useState<string>('5');
  const [durationMinutes, setDurationMinutes] = useState<string>('10');
  const [targetForceN, setTargetForceN] = useState<string>('70');
  const [useWarmup, setUseWarmup] = useState<boolean>(true);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [existingPlan, setExistingPlan] = useState<any>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  // Compute which weekdays are present in the selected plan range (0=Sun..6=Sat)
  function getAllowedWeekdays(start: string, end: string) {
    const allowed = [false, false, false, false, false, false, false];
    if (!start || !end) return allowed.map(() => true); // if no full range, allow all
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return allowed.map(() => true);
    // iterate from start to end inclusive
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      allowed[d.getDay()] = true;
    }
    return allowed;
  }

  // When range changes, clear any selected weekdays that are no longer allowed
  useEffect(() => {
    const allowed = getAllowedWeekdays(planStart, planEnd);
    setDaysOfWeek((prev) => prev.map((v, i) => (v && allowed[i] ? true : false)));
  }, [planStart, planEnd]);

  useEffect(() => {
    // Could fetch existing preset for patient and populate fields. Skipping for MVP.
  }, [patientId]);

  useEffect(() => {
    async function fetchPatient() {
      if (!authToken || Number.isNaN(patientId)) return;
      const res = await getDoctorPatient(authToken, patientId);
      if (res.success && res.data) {
        setPatientName((res.data as any).name ?? null);
        setPatientHn((res.data as any).hnCode ?? null);
      }
    }
    fetchPatient();
  }, [authToken, patientId]);

  useEffect(() => {
    async function fetchPresetAndSessions() {
      if (Number.isNaN(patientId)) return;
      const presetRes = await getPatientPreset(patientId);
      if (presetRes.success && presetRes.data) {
        const p = presetRes.data as any;
        setExistingPlan(p);
        setTargetFlexion(clampNumber(String(p.targetFlexion ?? 120), REALISTIC_LIMITS.flexion.min, REALISTIC_LIMITS.flexion.max));
        setTargetExtension(clampNumber(String(p.targetExtension ?? 0), REALISTIC_LIMITS.extension.min, REALISTIC_LIMITS.extension.max));
        setSpeedLevel(clampNumber(String(p.speedLevel ?? 5), REALISTIC_LIMITS.speed.min, REALISTIC_LIMITS.speed.max));
        setDurationMinutes(String(p.durationMinutes ?? 10));
        setUseWarmup(Boolean(p.useWarmup ?? true));
        setTargetForceN(String(p.targetForceN ?? 70));

        // Scheduling fields — convert ISO date to YYYY-MM-DD using local parts
        const toIsoDate = (s?: string) => {
          if (!s) return '';
          const d = new Date(s);
          if (Number.isNaN(d.getTime())) return '';
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        setPlanStart(toIsoDate(p.startDate));
        setPlanEnd(toIsoDate(p.endDate));
        setSessionsPerDay(String(p.sessionsPerDay ?? 1));
        if (Array.isArray(p.daysOfWeek)) {
          const next = [false, false, false, false, false, false, false];
          (p.daysOfWeek as number[]).forEach((idx) => {
            if (idx >= 0 && idx <= 6) next[idx] = true;
          });
          setDaysOfWeek(next);
        }
      } else {
        setExistingPlan(null);
      }

      const sessRes = await getPatientSessions(patientId, { limit: 20 });
      if (sessRes.success && Array.isArray(sessRes.data)) {
        setSessions(sessRes.data);
      }
    }
    fetchPresetAndSessions();
  }, [patientId]);

  async function handleSave() {
    if (!authToken) {
      Alert.alert('เข้าสู่ระบบใหม่', 'ไม่พบสิทธิ์การใช้งาน กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    setIsSaving(true);
    try {
      // validate dates and sessions
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (planStart && !dateRe.test(planStart)) {
        setPlanError('Start date must be YYYY-MM-DD');
        setIsSaving(false);
        return;
      }
      if (planEnd && !dateRe.test(planEnd)) {
        setPlanError('End date must be YYYY-MM-DD');
        setIsSaving(false);
        return;
      }
      if (planStart && planEnd) {
        const s = new Date(planStart).getTime();
        const e = new Date(planEnd).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || s > e) {
          setPlanError('Start date must be before or equal to end date');
          setIsSaving(false);
          return;
        }
      }
      const sessionsNum = Number(sessionsPerDay) || 0;
      if (sessionsPerDay && (Number.isNaN(sessionsNum) || sessionsNum <= 0 || sessionsNum > 3)) {
        setPlanError('Sessions per day must be between 1 and 3');
        setIsSaving(false);
        return;
      }

      const flexionValue = Number(targetFlexion);
      if (Number.isNaN(flexionValue) || flexionValue < REALISTIC_LIMITS.flexion.min || flexionValue > REALISTIC_LIMITS.flexion.max) {
        setPlanError(`Target Flexion must be between ${REALISTIC_LIMITS.flexion.min} and ${REALISTIC_LIMITS.flexion.max}`);
        setIsSaving(false);
        return;
      }

      const extensionValue = Number(targetExtension);
      if (Number.isNaN(extensionValue) || extensionValue < REALISTIC_LIMITS.extension.min || extensionValue > REALISTIC_LIMITS.extension.max) {
        setPlanError(`Target Extension must be between ${REALISTIC_LIMITS.extension.min} and ${REALISTIC_LIMITS.extension.max}`);
        setIsSaving(false);
        return;
      }

      const speedValue = Number(speedLevel);
      if (Number.isNaN(speedValue) || speedValue < REALISTIC_LIMITS.speed.min || speedValue > REALISTIC_LIMITS.speed.max) {
        setPlanError('Speed must be between 1 and 10');
        setIsSaving(false);
        return;
      }

      setPlanError(null);
      const days = daysOfWeek.reduce<number[]>((acc, v, i) => (v ? acc.concat(i) : acc), []);
      const payload: any = {
        flexion: flexionValue,
        extension: extensionValue,
        speed: speedValue,
        duration: Number(durationMinutes) || 10,
        warmUp: Boolean(useWarmup),
        targetForceN: targetForceN ? Number(targetForceN) : null,
        // forceLevel is the patient-side scaling ceiling. Doctor only sets targetForceN;
        // we always send 10 so the patient app interprets targetForceN as Level 10.
        forceLevel: 10,
        // Send startDate as start-of-day and endDate as end-of-day so that
        // single-day ranges (start === end) cover the full day instead of
        // collapsing to 00:00-00:00. Date strings are local YYYY-MM-DD.
        startDate: planStart ? `${planStart}T00:00:00.000` : undefined,
        endDate: planEnd ? `${planEnd}T23:59:59.999` : undefined,
        sessionsPerDay: Number(sessionsPerDay) || 1,
        daysOfWeek: days.length ? days : undefined,
      };

      const res = await putPatientPreset(authToken!, patientId, payload);
      if (!res.success) {
        Alert.alert('บันทึกแผนการรักษาไม่สำเร็จ', res.error || 'ไม่สามารถบันทึกแผนการรักษาได้');
        return;
      }

      // Refresh sessions after saving preset
      const sessRes = await getPatientSessions(patientId, { limit: 20 });
      if (sessRes.success && Array.isArray(sessRes.data)) setSessions(sessRes.data as any[]);

      setExistingPlan(res.data ?? true);
      setShowPlanModal(false);
      Alert.alert('บันทึกแผนการรักษา', 'บันทึกแผนการรักษาเรียบร้อย');
    } catch (err) {
      console.error(err);
      Alert.alert('บันทึกแผนการรักษาไม่สำเร็จ', 'เกิดข้อผิดพลาดขณะบันทึกแผนการรักษา');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeletePlan() {
    setConfirmDeleteVisible(true);
  }

  async function confirmDeactivatePlan() {
    if (!authToken) return;
    setIsDeletingPlan(true);
    const res = await deactivatePlan(authToken, patientId);
    setIsDeletingPlan(false);
    setConfirmDeleteVisible(false);
    if (res.success) {
      setExistingPlan(null);
      setPlanStart('');
      setPlanEnd('');
      setSessionsPerDay('1');
      setDaysOfWeek([false, false, false, false, false, false, false]);
      setTargetFlexion('120');
      setTargetExtension('0');
      setSpeedLevel('5');
      setDurationMinutes('10');
      setTargetForceN('70');
      setUseWarmup(true);
    } else {
      Alert.alert('หยุดแผนการรักษาไม่สำเร็จ', res.error || 'ไม่สามารถหยุดแผนการรักษาได้');
    }
  }

  function DateRangePickerModal({
    visible,
    startDate,
    endDate,
    onCancel,
    onConfirm,
  }: {
    visible: boolean;
    startDate?: string;
    endDate?: string;
    onCancel: () => void;
    onConfirm: (range: { startDate: string; endDate: string }) => void;
  }) {
    const defaultStyles = useDefaultStyles('light');
    const [rangeStart, setRangeStart] = useState<DateType>(startDate || undefined);
    const [rangeEnd, setRangeEnd] = useState<DateType>(endDate || undefined);

    useEffect(() => {
      if (!visible) return;
      setRangeStart(startDate || undefined);
      setRangeEnd(endDate || undefined);
    }, [visible, startDate, endDate]);

    function toIso(value: DateType) {
      if (!value) return '';
      // If the picker already provided a YYYY-MM-DD string, return it directly
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      // Some picker implementations return a wrapper object (looks like { $d: Date }) — prefer that
      let dObj: Date | null = null;
      try {
        if (value && typeof value === 'object' && ('$d' in (value as any)) && (value as any).$d instanceof Date) {
          dObj = (value as any).$d as Date;
        } else if (value && typeof value === 'object' && ('d' in (value as any)) && (value as any).d instanceof Date) {
          dObj = (value as any).d as Date;
        } else {
          dObj = new Date(value as any);
        }
      } catch (err) {
        dObj = new Date(value as any);
      }
      if (!dObj || Number.isNaN(dObj.getTime())) return '';
      // Use local date parts so the displayed day matches what the user tapped
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const day = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.datePickerOverlay}>
          <View style={[styles.datePickerCard, { backgroundColor: '#fff' }]}>
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>Select start and end</Text>
              <Text style={{ color: DSColors.text.secondary, fontSize: 12 }}>
                Tap the first date, then tap the last date to create a range.
              </Text>
            </View>

            <DateTimePicker
              mode="range"
              calendar="gregory"
              startDate={rangeStart as DateType}
              endDate={rangeEnd as DateType}
              minDate={(() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                return d;
              })()}
              showOutsideDays
              onChange={({ startDate: nextStartDate, endDate: nextEndDate }: { startDate: DateType; endDate: DateType }) => {
                // Debug log to inspect raw picker values and types
                try {
                  // eslint-disable-next-line no-console
                  console.log('DatePicker onChange raw:', { nextStartDate, nextEndDate, startType: typeof nextStartDate, endType: typeof nextEndDate });
                } catch (err) {}

                setRangeStart(nextStartDate || undefined);
                setRangeEnd(nextEndDate || undefined);

                if (nextStartDate && nextEndDate) {
                  const s = toIso(nextStartDate);
                  const e = toIso(nextEndDate);
                  try {
                    // eslint-disable-next-line no-console
                    console.log('DatePicker converted:', { s, e });
                  } catch (err) {}
                  onConfirm({ startDate: s, endDate: e });
                }
              }}
              styles={{
                ...defaultStyles,
                selected: { backgroundColor: DSColors.primary },
                selected_label: { color: DSColors.text.inverse },
                range_start: { backgroundColor: DSColors.primary },
                range_end: { backgroundColor: DSColors.primary },
                range_start_label: { color: DSColors.text.inverse },
                range_end_label: { color: DSColors.text.inverse },
                range_middle: { backgroundColor: `${DSColors.primary}22` },
                today: { borderColor: DSColors.primary, borderWidth: 1 },
              }}
              style={{ width: '100%' }}
            />

            <View style={styles.datePickerActions}>
              <Pressable
                onPress={() => {
                  setRangeStart(undefined);
                  setRangeEnd(undefined);
                  onConfirm({ startDate: '', endDate: '' });
                }}
                style={styles.outlineButton}
              >
                <Text style={styles.outlineButtonText}>Clear</Text>
              </Pressable>
              <Pressable onPress={onCancel} style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function formatRangeLabel(startDate: string, endDate: string) {
    if (!startDate && !endDate) return 'Select start and end';
    if (startDate && !endDate) return `${startDate} - select end`;
    if (!startDate && endDate) return `${endDate} - select start`;
    return `${startDate} → ${endDate}`;
  }

  // ─── Plan Form (shared between inline modal and main body) ──────────────
  const planFormContent = (
    <>
      <View style={{ marginBottom: 8 }}>
        <Text style={styles.fieldLabel}>Plan range</Text>
        <Pressable
          onPress={() => setShowRangePicker(true)}
          style={[styles.input, { justifyContent: 'center', minHeight: 48 }]}
        >
          <Text style={{ color: planStart || planEnd ? DSColors.text.primary : DSColors.text.secondary }}>
            {formatRangeLabel(planStart, planEnd)}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={isNarrow ? { width: '100%' } : { width: 160 }}>
          <Text style={styles.fieldLabel}>Sessions / day</Text>
          <TextInput
            value={sessionsPerDay}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, 1);
              const n = Number(digits);
              const clamped = digits === '' ? '' : String(Math.min(3, Math.max(1, n)));
              setSessionsPerDay(clamped);
              setPlanError(null);
            }}
            style={styles.input}
            keyboardType="numeric"
            maxLength={1}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Days of week</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((label, idx) => {
              const allowed = getAllowedWeekdays(planStart, planEnd)[idx];
              const isActive = daysOfWeek[idx];
              return (
                <Pressable
                  key={label}
                  onPress={() => {
                    if (!allowed) return;
                    const copy = [...daysOfWeek];
                    copy[idx] = !copy[idx];
                    setDaysOfWeek(copy);
                    setPlanError(null);
                  }}
                  disabled={!allowed}
                  style={[styles.weekdayChip, isActive && styles.weekdayChipActive, !allowed && styles.weekdayChipDisabled, { marginBottom: 6 }]}
                >
                  <Text style={[{ fontWeight: '600' }, isActive ? { color: DSColors.text.inverse } : !allowed ? { color: DSColors.text.secondary } : { color: DSColors.text.primary }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={{ ...DSTypography.caption, color: DSColors.text.secondary, marginBottom: 6 }}>PRESCRIPTION (PHASE 1)</Text>
      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Target Flexion (°)</Text>
          <TextInput value={targetFlexion} onChangeText={(v) => setTargetFlexion(clampNumber(v, REALISTIC_LIMITS.flexion.min, REALISTIC_LIMITS.flexion.max))} style={styles.input} keyboardType="numeric" maxLength={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Target Extension (°)</Text>
          <TextInput value={targetExtension} onChangeText={(v) => setTargetExtension(clampNumber(v, REALISTIC_LIMITS.extension.min, REALISTIC_LIMITS.extension.max))} style={styles.input} keyboardType="numeric" maxLength={4} />
        </View>
      </View>

      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Speed (1–10)</Text>
          <TextInput value={speedLevel} onChangeText={(v) => setSpeedLevel(clampNumber(v, REALISTIC_LIMITS.speed.min, REALISTIC_LIMITS.speed.max))} style={styles.input} keyboardType="numeric" maxLength={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Duration (min)</Text>
          <TextInput value={durationMinutes} onChangeText={setDurationMinutes} style={styles.input} keyboardType="numeric" />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Max Resistance Force (N) — เพดานสูงสุด (= Level 10)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <TextInput value={targetForceN} onChangeText={setTargetForceN} style={[styles.input, { flex: 1 }]} keyboardType="numeric" />
      </View>
      <Text style={{ ...DSTypography.caption, color: DSColors.text.secondary, marginBottom: 12 }}>
        ผู้ป่วยสามารถปรับเลเวลแรงได้ 1–10 ในระหว่างฝึก โดยแรงต่อเลเวล = {targetForceN ? (Number(targetForceN) / 10).toFixed(1) : '-'} N
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Switch value={useWarmup} onValueChange={setUseWarmup} />
        <Text style={{ marginLeft: 8 }}>Warm-up mode</Text>
      </View>

      {planError && <Text style={{ color: DSColors.danger, marginBottom: 8 }}>{planError}</Text>}
    </>
  );

  const body = (
    <View style={[styles.container, effectiveEmbedded && styles.embeddedContainer, styles.bodyContainer]}>
      <View style={styles.patientHeaderCard}>
        <View style={styles.patientHeaderTopRow}>
          <View style={styles.patientHeaderTitleRow}>
            <View style={styles.patientHeaderIconWrap}>
              <Ionicons name="person-circle" size={28} color={DSColors.primary} />
            </View>
            <ThemedText type="title" style={styles.heading}>จัดการผู้ป่วย</ThemedText>
          </View>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>ปิด</Text>
            </Pressable>
          )}
        </View>

        {(patientName || patientHn) && (
          <View style={styles.metaInline}>
            {patientName && (
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={16} color={DSColors.primary} />
                <Text style={styles.metaText}>{patientName}</Text>
              </View>
            )}
            {patientHn && (
              <View style={styles.metaRow}>
                <Ionicons name="card-outline" size={16} color={DSColors.primary} />
                <Text style={styles.metaText}>{patientHn}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={{ height: 16 }} />

      {/* ── Plan Section ── */}

      {existingPlan ? (
        // ── Plan Summary Card ──
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planCardTitle}>แผนการรักษาปัจจุบัน</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => { setPlanError(null); setShowPlanModal(true); }} style={styles.editChip}>
                <Text style={styles.editChipText}>แก้ไข</Text>
              </Pressable>
              <Pressable onPress={handleDeletePlan} style={styles.deactivateChip} disabled={isDeletingPlan}>
                {isDeletingPlan
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.deactivateChipText}>ปิดใช้งาน</Text>}
              </Pressable>
            </View>
          </View>

          {(planStart || planEnd) && (
            <View style={styles.planCardRow}>
              <View style={styles.planCardItem}>
                <Text style={styles.planCardLabel}>ช่วงวันที่</Text>
                <Text style={styles.planCardValue}>{planStart || '-'} → {planEnd || '-'}</Text>
              </View>
              <View style={styles.planCardItem}>
                <Text style={styles.planCardLabel}>Session / วัน</Text>
                <Text style={styles.planCardValue}>{sessionsPerDay}</Text>
              </View>
            </View>
          )}

          <View style={styles.planCardDivider} />

          <View style={styles.planCardRow}>
            <View style={styles.planCardItem}>
              <Text style={styles.planCardLabel}>Flexion</Text>
              <Text style={styles.planCardValue}>{targetFlexion}°</Text>
            </View>
            <View style={styles.planCardItem}>
              <Text style={styles.planCardLabel}>Extension</Text>
              <Text style={styles.planCardValue}>{targetExtension}°</Text>
            </View>
            <View style={styles.planCardItem}>
              <Text style={styles.planCardLabel}>Duration</Text>
              <Text style={styles.planCardValue}>{durationMinutes} นาที</Text>
            </View>
            <View style={styles.planCardItem}>
              <Text style={styles.planCardLabel}>Speed</Text>
              <Text style={styles.planCardValue}>Lv.{speedLevel}</Text>
            </View>
            <View style={styles.planCardItem}>
              <Text style={styles.planCardLabel}>Force</Text>
              <Text style={styles.planCardValue}>{targetForceN} N</Text>
            </View>
          </View>
        </View>
      ) : (
        // ── No Plan: Create Button ──
        <Pressable onPress={() => { setPlanError(null); setShowPlanModal(true); }} style={styles.createPlanBtn}>
          <Text style={styles.createPlanBtnText}>+ สร้างแผนการรักษา</Text>
        </Pressable>
      )}

      {/* ── Plan Form Modal ── */}
      <Modal visible={showPlanModal} transparent animationType="slide" onRequestClose={() => setShowPlanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{existingPlan ? 'ปรับแผนการรักษา' : 'กำหนดแผนการรักษา'}</Text>
              <Pressable onPress={() => setShowPlanModal(false)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: DSColors.text.secondary, fontWeight: '600' }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {planFormContent}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowPlanModal(false)} style={[styles.outlineButton, { flex: 1 }]}>
                <Text style={[styles.outlineButtonText, { textAlign: 'center' }]}>ยกเลิก</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (!isSaving) handleSave(); }}
                style={[styles.primaryButton, { flex: 2, opacity: isSaving ? 0.6 : 1 }]}
              >
                <Text style={[styles.primaryButtonText, { textAlign: 'center' }]}>
                  {isSaving ? 'กำลังบันทึก...' : 'Save & Send to Machine'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <DateRangePickerModal
        visible={showRangePicker}
        startDate={planStart}
        endDate={planEnd}
        onCancel={() => setShowRangePicker(false)}
        onConfirm={({ startDate, endDate }) => {
          setPlanStart(startDate);
          setPlanEnd(endDate);
          setPlanError(null);
          if (startDate || endDate) setShowRangePicker(false);
        }}
      />

      {/* Confirm Deactivate Plan Modal */}
      <Modal
        visible={confirmDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteVisible(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setConfirmDeleteVisible(false)}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>หยุดแผนการรักษา</Text>
            <Text style={styles.confirmMessage}>
              ต้องการหยุดแผนการรักษานี้ใช่ไหม?{'\n'}ข้อมูล session เดิมจะยังคงอยู่ครบถ้วน
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setConfirmDeleteVisible(false)}
                style={[styles.outlineButton, { flex: 1, marginRight: 0 }]}
                disabled={isDeletingPlan}
              >
                <Text style={[styles.outlineButtonText, { textAlign: 'center' }]}>ยกเลิก</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeactivatePlan}
                style={[styles.primaryButton, { flex: 1 }, isDeletingPlan && { opacity: 0.6 }]}
                disabled={isDeletingPlan}
              >
                <Text style={[styles.primaryButtonText, { textAlign: 'center' }]}>
                  {isDeletingPlan ? 'กำลังหยุด...' : 'หยุดแผน'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <View style={{ height: 24 }} />

      <ThemedView style={[styles.chartCard, isNarrow ? styles.chartCardNarrow : {}, isAndroidTablet ? styles.chartCardTablet : {}]}>
        <View style={styles.chartCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chartCardTitle}>ความคืบหน้าการรักษา</Text>
            <Text style={styles.chartCardSubtitle}>Target vs Actual Flexion</Text>
          </View>
        </View>

        {/* Period filter — matches patient programs.tsx */}
        <View style={styles.periodRow}>
          {(['7d', '30d', 'all'] as const).map((key) => {
            const label = key === '7d' ? '7 วัน' : key === '30d' ? '30 วัน' : 'ทั้งหมด';
            const active = selectedPeriod === key;
            return (
              <Pressable
                key={key}
                style={[styles.periodTab, active && styles.periodTabActive]}
                onPress={() => setSelectedPeriod(key)}
              >
                <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sessions.filter((s) => s.kind === 'session').length > 0 ? (
          (() => {
            const allSessionEntries = sessions.filter((s): s is Extract<SessionResponse, { kind: 'session' }> => s.kind === 'session');

            // Filter by selected period before aggregating.
            const periodCutoff = selectedPeriod === 'all'
              ? 0
              : Date.now() - (selectedPeriod === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000;
            const sessionEntries = selectedPeriod === 'all'
              ? allSessionEntries
              : allSessionEntries.filter((s) => new Date(s.sessionDate).getTime() >= periodCutoff);

            // Aggregate to one point per day (max flexion across that day's sessions).
            // Format matches programs.tsx (patient): D/M labels, 10 days max.
            const MAX_CHART_POINTS = 10;

            // Group by Bangkok day so a Bangkok-evening session doesn't roll into
            // the next UTC day on this dashboard.
            const byDay = new Map<string, { ts: number; max: number; key: string }>();
            sessionEntries.forEach((s) => {
              const d = new Date(s.sessionDate);
              const key = toBangkokDateKey(d);
              const value = Number(s.actualMaxFlexion) || 0;
              const existing = byDay.get(key);
              if (!existing || value > existing.max) {
                byDay.set(key, { ts: d.getTime(), max: Math.max(existing?.max ?? 0, value), key });
              }
            });
            const dailyAsc = Array.from(byDay.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
            const recentDays = dailyAsc.slice(-MAX_CHART_POINTS);
            const labels = recentDays.map((g) => {
              const [, mm, dd] = g.key.split('-');
              return `${Number(dd)}/${Number(mm)}`;
            });
            const actualValues = recentDays.map((g) => g.max);
            const targetValues = recentDays.map(() => Number(targetFlexion) || 0);

            if (isAndroidTablet) {
              const recent = recentDays.map((g) => ({
                sessionDate: new Date(g.ts).toISOString(),
                actualMaxFlexion: g.max,
              }));
              return <AndroidTabletProgressFallback sessions={recent} targetFlexion={targetFlexion} />;
            }

            // Card has paddingHorizontal=12 (x2) + screen padding 20 (x2) + 1px border (x2)
            // = ~66px of horizontal chrome to subtract before computing the chart width.
            const cardChromeX = 66;
            const chartWidth = isCompactEmbedded
              ? Math.max(260, Math.min(440, width - 24 - cardChromeX))
              : Math.max(260, Math.min(900, width - (isNarrow ? 32 : 160) - cardChromeX));
            const chartHeight = isCompactEmbedded ? 168 : isNarrow ? 176 : 180;
            const usableWidth = Math.max(260, Math.min(chartWidth, width - (isNarrow ? 24 : 160) - cardChromeX));
            const chartRenderHeight = Math.max(160, chartHeight);

            // Same dataset pattern as programs.tsx: two invisible series clamp the Y range,
            // target as dashed line, actual as solid thick line.
            // Dynamic Y range: ±10° padding around the actual data so the chart auto-fits.
            const allValues = [...actualValues, ...targetValues].filter((v) => Number.isFinite(v));
            const dataMin = allValues.length > 0 ? Math.min(...allValues) : 50;
            const dataMax = allValues.length > 0 ? Math.max(...allValues) : 130;
            const yFloor = Math.max(0, Math.floor(dataMin - 10));
            const yCeiling = Math.ceil(dataMax + 10);

            const chartData = {
              labels,
              datasets: [
                { data: recentDays.map(() => yFloor),   color: (): string => 'rgba(0,0,0,0)', strokeWidth: 0 },
                { data: recentDays.map(() => yCeiling), color: (): string => 'rgba(0,0,0,0)', strokeWidth: 0 },
                { data: targetValues, color: (): string => TARGET_LINE_COLOR, strokeWidth: 2, strokeDashArray: [6, 4] },
                { data: actualValues, color: (): string => ACTUAL_LINE_COLOR, strokeWidth: 3 },
              ],
            };

            const cfg = makeChartConfig(DSColors.text.secondary, DSColors.borderLight);

            return (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <View style={{ width: usableWidth }}>
                  <LineChart
                    data={chartData as any}
                    width={usableWidth}
                    height={chartRenderHeight}
                    chartConfig={cfg}
                    withDots
                    withInnerLines
                    withOuterLines
                    style={{ borderRadius: 12, overflow: 'hidden' }}
                    formatYLabel={(v) => `${Math.round(Number(v))}°`}
                    fromZero={false}
                    yLabelsOffset={8}
                    segments={5}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                    <View style={styles.androidTabletLegendItem}>
                      <View style={[styles.androidTabletLegendDot, { backgroundColor: TARGET_LINE_COLOR }]} />
                      <Text style={styles.androidTabletLegendText}>เป้าหมายแพทย์</Text>
                    </View>
                    <View style={styles.androidTabletLegendItem}>
                      <View style={[styles.androidTabletLegendDot, { backgroundColor: ACTUAL_LINE_COLOR }]} />
                      <Text style={styles.androidTabletLegendText}>ที่ทำได้จริง</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })()
        ) : (
          <ThemedText type="default" style={{ color: DSColors.text.secondary }}>ไม่มีข้อมูลประวัติการบำบัดสำหรับแสดงกราฟ</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.historyCard}>
        <View style={styles.historyCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyCardTitle}>ประวัติการบำบัด</Text>
            <Text style={styles.historyCardSubtitle}>Session History</Text>
          </View>
        </View>

        {sessions.length === 0 ? (
          <ThemedText type="default" style={styles.empty}>ยังไม่มีประวัติการบำบัด</ThemedText>
        ) : (
          <View>
          {sessions.slice().sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()).map((item) => {
            const sessionTarget = item.plan?.targetFlexion;
            if (item.kind === 'missed') {
              return (
                <ThemedView
                  key={`m-${item.planId}-${item.sessionDate}`}
                  style={[styles.sessionRow, { opacity: 0.7 }]}
                >
                  <View style={styles.sessionItemRow}>
                    <View style={styles.sessionItemLeft}>
                      <Ionicons name="close-circle-outline" size={18} color={DSColors.danger} />
                      <Text style={styles.sessionItemLabel}>ไม่ได้ทำตามแผน</Text>
                    </View>
                    <Text style={[styles.sessionItemValue, { color: DSColors.danger }]}>
                      {item.completedSessions}/{item.expectedSessions}
                    </Text>
                  </View>
                  <View style={styles.sessionItemRow}>
                    <View style={styles.sessionItemLeft}>
                      <Ionicons name="calendar-outline" size={18} color={DSColors.text.secondary} />
                      <Text style={styles.sessionItemLabel}>วันที่</Text>
                    </View>
                    <Text style={styles.sessionItemValue}>{new Date(item.sessionDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}</Text>
                  </View>
                  <View style={[styles.sessionItemRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.sessionItemLeft}>
                      <Ionicons name="flag-outline" size={18} color={TARGET_LINE_COLOR} />
                      <Text style={styles.sessionItemLabel}>Target Flexion</Text>
                    </View>
                    <Text style={[styles.sessionItemValue, { color: TARGET_LINE_COLOR }]}>
                      {sessionTarget != null ? `${sessionTarget}°` : '-'}
                    </Text>
                  </View>
                </ThemedView>
              );
            }
            return (
              <ThemedView key={`s-${item.id}`} style={styles.sessionRow}>
                <View style={styles.sessionItemRow}>
                  <View style={styles.sessionItemLeft}>
                    <Ionicons name="time-outline" size={18} color={DSColors.text.secondary} />
                    <Text style={styles.sessionItemLabel}>เวลา</Text>
                  </View>
                  <Text style={styles.sessionItemValue}>{new Date(item.sessionDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</Text>
                </View>
                <View style={styles.sessionItemRow}>
                  <View style={styles.sessionItemLeft}>
                    <Ionicons name="flag-outline" size={18} color={TARGET_LINE_COLOR} />
                    <Text style={styles.sessionItemLabel}>Target Flexion</Text>
                  </View>
                  <Text style={[styles.sessionItemValue, { color: TARGET_LINE_COLOR }]}>
                    {sessionTarget != null ? `${sessionTarget}°` : '-'}
                  </Text>
                </View>
                <View style={[styles.sessionItemRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.sessionItemLeft}>
                    <Ionicons name="trending-up" size={18} color={DSColors.primary} />
                    <Text style={styles.sessionItemLabel}>Actual Max Flexion</Text>
                  </View>
                  <Text style={[styles.sessionItemValue, { color: DSColors.primary }]}>
                    {item.actualMaxFlexion}°
                  </Text>
                </View>
              </ThemedView>
            );
          })}
        </View>
      )}
      </ThemedView>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isAndroidTablet ? DSColors.background : (effectiveEmbedded ? 'transparent' : undefined) }}>
      <View style={styles.screenShell}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContainer, effectiveEmbedded && styles.embeddedScrollContainer]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {body}
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
      padding: 20,
    backgroundColor: DSColors.background,
  },
  heading: {
    ...DSTypography.h2,
    marginBottom: 8,
    color: DSColors.text.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  patientHeaderCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 16,
    marginBottom: 16,
    ...DSShadowSoft,
  },
  patientHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  patientHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  patientHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
  },
  closeButtonText: {
    color: DSColors.text.primary,
    fontWeight: '600',
  },
  meta: {
    ...DSTypography.captionBold,
    marginBottom: 8,
    color: DSColors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    borderWidth: 1,
    borderColor: DSColors.primary + '30',
    backgroundColor: DSColors.primaryLight,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    ...DSTypography.captionBold,
    color: DSColors.primaryDark,
  },
  label: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 6,
  },
  fieldLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 4,
  },
  sectionLabel: {
    ...DSTypography.captionBold,
    color: DSColors.text.primary,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase' as const,
  },
  // Plan card
  planCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 16,
    marginBottom: 4,
    ...DSShadowSoft,
  },
  planCardHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  planCardTitle: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  editChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.warning,
  },
  editChipText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  deleteChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    borderWidth: 1,
    borderColor: DSColors.danger,
    backgroundColor: DSColors.surface,
    minWidth: 44,
    alignItems: 'center' as const,
  },
  deleteChipText: {
    color: DSColors.danger,
    fontWeight: '600' as const,
    fontSize: 13,
  },
  deactivateChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.danger,
    minWidth: 44,
    alignItems: 'center' as const,
  },
  deactivateChipText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  planCardRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 8,
  },
  planCardItem: {
    minWidth: 72,
  },
  planCardLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 2,
  },
  planCardValue: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  planCardDivider: {
    height: 1,
    backgroundColor: DSColors.borderLight,
    marginVertical: 8,
  },
  // Create plan button
  createPlanBtn: {
    borderWidth: 1.5,
    borderColor: DSColors.primary,
    borderStyle: 'dashed' as const,
    borderRadius: DSShape.radiusCard,
    padding: 20,
    alignItems: 'center' as const,
    backgroundColor: DSColors.surface,
  },
  createPlanBtnText: {
    color: DSColors.primary,
    fontWeight: '700' as const,
    fontSize: 16,
  },
  // Plan form modal — full screen
  modalOverlay: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  modalCard: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  modalTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
  },
  modalFooter: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
    backgroundColor: DSColors.background,
  },
  input: {
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 10,
    borderRadius: DSShape.radiusButton,
    marginBottom: 8,
    backgroundColor: DSColors.surface,
    color: DSColors.text.primary,
  },
  chartCard: {
    minHeight: 220,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
    ...DSShadowSoft,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    paddingHorizontal: 4,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  chartCardTitle: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  chartCardSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 16,
    marginBottom: 16,
    ...DSShadowSoft,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  historyCardTitle: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  historyCardSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  chartCardTablet: {
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: DSColors.surface,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  chartCardNarrow: {
    minHeight: 240,
  },
  androidTabletProgressWrap: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
  },
  androidTabletProgressHeader: {
    marginBottom: 4,
  },
  androidTabletProgressTitle: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  androidTabletProgressSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  androidTabletProgressLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  androidTabletLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  androidTabletLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  androidTabletLegendText: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  androidTabletProgressCard: {
    borderWidth: 1,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusButton,
    padding: 10,
    backgroundColor: DSColors.surface,
    gap: 8,
  },
  androidTabletProgressRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'flex-start',
  },
  androidTabletProgressDate: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  androidTabletProgressValue: {
    ...DSTypography.captionBold,
    color: DSColors.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  androidTabletProgressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: DSColors.borderLight,
    overflow: 'hidden',
    position: 'relative',
  },
  androidTabletProgressTarget: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#7DD3FC',
    opacity: 0.35,
    borderRadius: 999,
  },
  androidTabletProgressActual: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: DSColors.primary,
    borderRadius: 999,
  },
  androidTabletProgressInfo: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  empty: {
    color: DSColors.text.secondary,
    marginBottom: 12,
  },
  sessionRow: {
    padding: 12,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  weekdayChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  weekdayChipActive: {
    backgroundColor: DSColors.primary,
    borderColor: DSColors.primary,
  },
  weekdayChipDisabled: {
    backgroundColor: DSColors.surface,
    borderColor: DSColors.border,
    opacity: 0.45,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerCard: {
    width: '92%',
    maxWidth: 520,
    minWidth: 300,
    padding: 16,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  datePartInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    color: DSColors.text.primary,
    textAlign: 'center',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  sessionDate: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 6,
  },
  sessionText: {
    ...DSTypography.body,
    color: DSColors.text.primary,
  },
  sessionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  sessionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sessionItemLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  sessionItemValue: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
    textAlign: 'right',
  },
  primaryButton: {
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  outlineButtonText: {
    color: DSColors.text.primary,
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    marginRight: 8,
  },
  embeddedContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    flex: 1,
  },
  screenShell: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  bodyContainer: {
    width: '100%',
      maxWidth: 980,
      alignSelf: 'center',
  },
  embeddedScrollContainer: {
    justifyContent: 'flex-start',
  },
  // Confirm Deactivate Plan modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DSLayout.screenPadding,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.screenPadding,
  },
  confirmTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 12,
  },
  confirmMessage: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveFooter: {
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
    backgroundColor: DSColors.background,
    paddingHorizontal: DSLayout.screenPadding,
    paddingVertical: 12,
  },
  saveFooterEmbedded: {
    backgroundColor: DSColors.surface,
    borderTopColor: DSColors.borderLight,
  },
  saveButton: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: DSColors.background,
    borderRadius: DSShape.radiusChip,
    padding: 4,
    marginTop: 8,
    marginBottom: 12,
    gap: 4,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: DSShape.radiusChip - 2,
  },
  periodTabActive: {
    backgroundColor: DSColors.primary,
  },
  periodTabText: {
    ...DSTypography.captionBold,
    color: DSColors.text.secondary,
  },
  periodTabTextActive: {
    color: DSColors.text.inverse,
  },
});
