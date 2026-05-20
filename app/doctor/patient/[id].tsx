import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TextInput, Switch, StyleSheet, Pressable, Text, TouchableOpacity, useWindowDimensions, Modal, ScrollView, Platform } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import { DSColors, DSLayout, DSShape, DSShadowSoft, DSTypography } from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { putPatientPreset, getDoctorPatient, getPatientPreset, getPatientSessions } from '@/services/apiClient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import DateTimePicker, { useDefaultStyles, type DateType } from 'react-native-calendars-datepicker';

type ChartPoint = {
  x: number;
  y: number;
};

function buildLinePath(points: ChartPoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const commands: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const controlX = (previous.x + current.x) / 2;
    commands.push(`C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`);
  }
  return commands.join(' ');
}

function buildAreaPath(points: ChartPoint[], baseY: number) {
  if (points.length === 0) return '';
  const linePath = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${linePath} L ${lastPoint.x} ${baseY} L ${firstPoint.x} ${baseY} Z`;
}

function formatChartValue(value: number) {
  return String(Math.round(value));
}

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
        const label = sessionDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
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
  const [forceLevel, setForceLevel] = useState<string>('1');
  const [targetForceN, setTargetForceN] = useState<string>('70');
  const [useWarmup, setUseWarmup] = useState<boolean>(true);
  const [sessions, setSessions] = useState<any[]>([]);

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
        const p = presetRes.data;
        setTargetFlexion(clampNumber(String(p.targetFlexion ?? 120), REALISTIC_LIMITS.flexion.min, REALISTIC_LIMITS.flexion.max));
        setTargetExtension(clampNumber(String(p.targetExtension ?? 0), REALISTIC_LIMITS.extension.min, REALISTIC_LIMITS.extension.max));
        setSpeedLevel(clampNumber(String(p.speedLevel ?? 5), REALISTIC_LIMITS.speed.min, REALISTIC_LIMITS.speed.max));
        setDurationMinutes(String(p.durationMinutes ?? 10));
        setUseWarmup(Boolean(p.useWarmup ?? true));
        setTargetForceN(String(p.targetForceN ?? 70));
        setForceLevel(clampNumber(String(p.forceLevel ?? 1), REALISTIC_LIMITS.forceLevel.min, REALISTIC_LIMITS.forceLevel.max));
      }

      const sessRes = await getPatientSessions(patientId, { limit: 20 });
      if (sessRes.success && Array.isArray(sessRes.data)) {
        setSessions(sessRes.data as any[]);
      }
    }
    fetchPresetAndSessions();
  }, [patientId]);

  async function handleSave() {
    if (!authToken) {
      alert('ไม่พบสิทธิ์การใช้งาน กรุณาเข้าสู่ระบบใหม่');
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
      if (sessionsPerDay && (Number.isNaN(sessionsNum) || sessionsNum <= 0)) {
        setPlanError('Sessions per day must be a positive number');
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

      const forceLevelValue = Number(forceLevel);
      if (Number.isNaN(forceLevelValue) || forceLevelValue < REALISTIC_LIMITS.forceLevel.min || forceLevelValue > REALISTIC_LIMITS.forceLevel.max) {
        setPlanError('Force Level must be between 1 and 10');
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
        forceLevel: forceLevelValue,
        startDate: planStart || undefined,
        endDate: planEnd || undefined,
        sessionsPerDay: Number(sessionsPerDay) || 1,
        daysOfWeek: days.length ? days : undefined,
      };

      const res = await putPatientPreset(authToken!, patientId, payload);
      if (!res.success) {
        alert(res.error || 'ไม่สามารถบันทึกแผนได้');
        return;
      }

      // Refresh sessions after saving preset
      const sessRes = await getPatientSessions(patientId, { limit: 20 });
      if (sessRes.success && Array.isArray(sessRes.data)) setSessions(sessRes.data as any[]);

      alert('บันทึกแผนสำเร็จ');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดขณะบันทึกแผน');
    } finally {
      setIsSaving(false);
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
              showOutsideDays
              onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
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

  const body = (
    <View style={[styles.container, effectiveEmbedded && styles.embeddedContainer, styles.bodyContainer]}>
      <View style={styles.headerRow}>
        <ThemedText type="title" style={styles.heading}>{'จัดการแผนผู้ป่วย #'}{patientId}</ThemedText>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>ปิด</Text>
          </Pressable>
        )}
      </View>
      {patientName && <ThemedText type="default" style={styles.meta}>ชื่อ: {patientName}</ThemedText>}
      {patientHn && <ThemedText type="default" style={styles.meta}>HN: {patientHn}</ThemedText>}

      <View style={{ height: 8 }} />
      {/* <ThemedText type="subtitle" style={{ marginBottom: 8, color: DSColors.text.primary }}>Weekly Plan</ThemedText> */}
      <View style={{ marginBottom: 8 }}>
        <Text>Plan range</Text>
        <Pressable
          onPress={() => setShowRangePicker(true)}
          style={[styles.input, { justifyContent: 'center', minHeight: 48 }]}
        >
          <Text style={{ color: planStart || planEnd ? DSColors.text.primary : DSColors.text.secondary }}>
            {formatRangeLabel(planStart, planEnd)}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <View style={isNarrow ? { width: '100%' } : { width: 160 }}>
          <Text>Sessions / day</Text>
          <TextInput value={sessionsPerDay} onChangeText={(t) => { setSessionsPerDay(t); setPlanError(null); }} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 6 }}>Days of week</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((label, idx) => {
              const allowed = getAllowedWeekdays(planStart, planEnd)[idx];
              const isActive = daysOfWeek[idx];
              return (
                <Pressable
                  key={label}
                  onPress={() => {
                    if (!allowed) return; // disable toggling if not in range
                    const copy = [...daysOfWeek];
                    copy[idx] = !copy[idx];
                    setDaysOfWeek(copy);
                    setPlanError(null);
                  }}
                  disabled={!allowed}
                  style={[
                    styles.weekdayChip,
                    isActive && styles.weekdayChipActive,
                    !allowed && styles.weekdayChipDisabled,
                    { marginBottom: 6 },
                  ]}
                >
                  <Text style={[{ fontWeight: '600' }, isActive ? { color: DSColors.text.inverse } : !allowed ? { color: DSColors.text.muted } : { color: DSColors.text.primary }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <DateRangePickerModal
        visible={showRangePicker}
        startDate={planStart}
        endDate={planEnd}
        onCancel={() => setShowRangePicker(false)}
        onConfirm={({ startDate, endDate }) => {
          setPlanStart(startDate);
          setPlanEnd(endDate);
          setPlanError(null);
          if (startDate || endDate) {
            setShowRangePicker(false);
          }
        }}
      />

      {planError && <ThemedText type="default" style={{ color: DSColors.danger, marginBottom: 8 }}>{planError}</ThemedText>}

      <Text style={{ ...DSTypography.caption, marginBottom: 6 }}>PRESCRIPTION (PHASE 1)</Text>
      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text>Target Flexion (°)</Text>
          <TextInput
            value={targetFlexion}
            onChangeText={(value) => setTargetFlexion(clampNumber(value, REALISTIC_LIMITS.flexion.min, REALISTIC_LIMITS.flexion.max))}
            style={styles.input}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text>Target Extension (°)</Text>
          <TextInput
            value={targetExtension}
            onChangeText={(value) => setTargetExtension(clampNumber(value, REALISTIC_LIMITS.extension.min, REALISTIC_LIMITS.extension.max))}
            style={styles.input}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
      </View>

      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text>Speed (1–10)</Text>
          <TextInput
            value={speedLevel}
            onChangeText={(value) => setSpeedLevel(clampNumber(value, REALISTIC_LIMITS.speed.min, REALISTIC_LIMITS.speed.max))}
            style={styles.input}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text>Duration (min)</Text>
          <TextInput value={durationMinutes} onChangeText={setDurationMinutes} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={isNarrow ? { width: '100%' } : { width: 120 }}>
          <Text>Force Level (1–10)</Text>
          <TextInput
            value={forceLevel}
            onChangeText={(value) => setForceLevel(clampNumber(value, REALISTIC_LIMITS.forceLevel.min, REALISTIC_LIMITS.forceLevel.max))}
            style={styles.input}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>
      </View>

      <Text style={{ marginBottom: 6 }}>Max Resistance Force (N)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <TextInput value={targetForceN} onChangeText={setTargetForceN} style={[styles.input, { flex: 1 }]} keyboardType="numeric" />
        <Text style={{ width: 48 }}>{targetForceN} N</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Switch value={useWarmup} onValueChange={setUseWarmup} />
        <Text style={{ marginLeft: 8 }}>Warm-up mode</Text>
      </View>

      <ThemedText type="default" style={styles.sectionLabel}>PROGRESS — TARGET VS ACTUAL FLEXION (LAST 7 SESSIONS)</ThemedText>
      <ThemedView style={[styles.chartCard, isNarrow ? styles.chartCardNarrow : {}, isAndroidTablet ? styles.chartCardTablet : {}]}>
        {sessions.length > 0 ? (
          (() => {
            const recent = sessions.slice(-7);
            const labels = recent.map((s) => new Date((s as any).sessionDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }));
            const actuals = recent.map((s) => Number((s as any).actualMaxFlexion) || 0);
            const target = recent.map(() => Number(targetFlexion) || 0);
            if (isAndroidTablet) {
              return <AndroidTabletProgressFallback sessions={recent} targetFlexion={targetFlexion} />;
            }

            const dataMax = Math.max(...actuals, ...target, 1);
            const dataMin = Math.max(0, Math.min(...actuals, ...target) - 5);
            const chartWidth = isCompactEmbedded
              ? Math.max(260, Math.min(440, width - 24))
              : Math.max(280, Math.min(900, width - (isNarrow ? 32 : 160)));
            const chartHeight = isCompactEmbedded ? 168 : isNarrow ? 176 : 180;
            const paddingLeft = 34;
            const paddingRight = 18;
            const paddingTop = 16;
            const paddingBottom = 34;
            const innerWidth = chartWidth - paddingLeft - paddingRight;
            const innerHeight = chartHeight - paddingTop - paddingBottom;
            const range = Math.max(1, dataMax - dataMin);

            const mapPoint = (value: number, index: number, total: number): ChartPoint => ({
              x: paddingLeft + (total <= 1 ? innerWidth / 2 : (index / (total - 1)) * innerWidth),
              y: paddingTop + (dataMax - value) / range * innerHeight,
            });

            const actualPoints = actuals.map((value, index) => mapPoint(value, index, actuals.length));
            const targetPoints = target.map((value, index) => mapPoint(value, index, target.length));
            const actualPath = buildLinePath(actualPoints);
            const targetPath = buildLinePath(targetPoints);
            const actualArea = buildAreaPath(actualPoints, paddingTop + innerHeight);
            const targetArea = buildAreaPath(targetPoints, paddingTop + innerHeight);

            return (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Svg width={chartWidth} height={chartHeight}>
                  <Defs>
                    <LinearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={DSColors.primary} stopOpacity="0.18" />
                      <Stop offset="100%" stopColor={DSColors.primary} stopOpacity="0.02" />
                    </LinearGradient>
                    <LinearGradient id="targetFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.16" />
                      <Stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.02" />
                    </LinearGradient>
                  </Defs>

                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const y = paddingTop + innerHeight * step;
                    const value = Math.round(dataMax - range * step);
                    return (
                      <React.Fragment key={String(step)}>
                        <Line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke={DSColors.borderLight} strokeWidth="1" opacity="0.8" />
                        <SvgText x={paddingLeft - 8} y={y + 4} fontSize="10" fill={DSColors.text.secondary} textAnchor="end">
                          {formatChartValue(value)}°
                        </SvgText>
                      </React.Fragment>
                    );
                  })}

                  <Path d={actualArea} fill="url(#actualFill)" />
                  <Path d={targetArea} fill="url(#targetFill)" />
                  {targetPath ? <Path d={targetPath} stroke="#7DD3FC" strokeWidth="2.5" fill="none" strokeDasharray="6 4" /> : null}
                  {actualPath ? <Path d={actualPath} stroke={DSColors.primary} strokeWidth="3" fill="none" /> : null}

                  {actualPoints.map((point, index) => (
                    <Circle key={`actual-${index}`} cx={point.x} cy={point.y} r="4" fill={DSColors.primary} />
                  ))}
                  {targetPoints.map((point, index) => (
                    <Circle key={`target-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#7DD3FC" />
                  ))}

                  {labels.map((label, index) => {
                    const x = mapPoint(0, index, labels.length).x;
                    return (
                      <SvgText
                        key={`${label}-${index}`}
                        x={x}
                        y={chartHeight - 10}
                        fontSize="10"
                        fill={DSColors.text.secondary}
                        textAnchor="middle"
                      >
                        {label}
                      </SvgText>
                    );
                  })}
                </Svg>
              </View>
            );
          })()
        ) : (
          <ThemedText type="default" style={{ color: DSColors.text.secondary }}>ไม่มีข้อมูลประวัติการบำบัดสำหรับแสดงกราฟ</ThemedText>
        )}
      </ThemedView>

      <ThemedText type="default" style={styles.sectionLabel}>SESSION HISTORY</ThemedText>
      {sessions.length === 0 ? (
        <ThemedText type="default" style={styles.empty}>ยังไม่มีประวัติการบำบัด</ThemedText>
      ) : (
        <View>
          {sessions.map((item) => (
            <ThemedView key={String((item as any).id)} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>{new Date((item as any).sessionDate).toLocaleString()}</Text>
              <Text style={styles.sessionText}>Actual Max Flexion: {(item as any).actualMaxFlexion}</Text>
              <Text style={styles.sessionText}>Status: {(item as any).sessionStatus}</Text>
            </ThemedView>
          ))}
        </View>
      )}
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

        <View style={[styles.saveFooter, effectiveEmbedded && styles.saveFooterEmbedded]}>
          <Pressable
            onPress={() => { if (!isSaving) handleSave(); }}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.saveButton,
              { opacity: isSaving ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>{isSaving ? 'กำลังบันทึก...' : 'Save & Send to Machine'}</Text>
          </Pressable>
        </View>
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
    ...DSTypography.body,
    marginBottom: 8,
    color: DSColors.text.secondary,
  },
  label: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 6,
  },
  sectionLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 8,
    marginTop: 4,
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
    height: 160,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderWidth: 1,
    borderColor: DSColors.border,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...DSShadowSoft,
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
    height: 180,
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
  primaryButton: {
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: DSColors.text.primary,
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
});
