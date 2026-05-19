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
  const isCompactEmbedded = embedded && isNarrow;
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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
        setTargetFlexion(String(p.targetFlexion ?? 120));
        setTargetExtension(String(p.targetExtension ?? 0));
        setSpeedLevel(String(p.speedLevel ?? 5));
        setDurationMinutes(String(p.durationMinutes ?? 10));
        setUseWarmup(Boolean(p.useWarmup ?? true));
        setTargetForceN(String(p.targetForceN ?? 70));
        setForceLevel(String(p.forceLevel ?? 1));
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
      setPlanError(null);
      const days = daysOfWeek.reduce<number[]>((acc, v, i) => (v ? acc.concat(i) : acc), []);
      const payload: any = {
        flexion: Number(targetFlexion) || 120,
        extension: Number(targetExtension) || 0,
        speed: Number(speedLevel) || 5,
        duration: Number(durationMinutes) || 10,
        warmUp: Boolean(useWarmup),
        targetForceN: targetForceN ? Number(targetForceN) : null,
        forceLevel: forceLevel ? Number(forceLevel) : null,
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

  function DatePickerModal({ visible, initial, onCancel, onConfirm }: { visible: boolean; initial?: string; onCancel: () => void; onConfirm: (iso: string) => void }) {
    const [y, setY] = useState('');
    const [m, setM] = useState('');
    const [d, setD] = useState('');

    useEffect(() => {
      const src = initial ? new Date(initial) : new Date();
      setY(String(src.getFullYear()));
      setM(String(src.getMonth() + 1).padStart(2, '0'));
      setD(String(src.getDate()).padStart(2, '0'));
    }, [initial, visible]);

    function confirm() {
      const iso = `${y}-${String(Number(m)).padStart(2,'0')}-${String(Number(d)).padStart(2,'0')}`;
      onConfirm(iso);
    }

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerCard}>
            <Text style={{ marginBottom: 8 }}>Select date</Text>
            <View style={styles.datePickerRow}>
              <TextInput style={styles.datePartInput} value={y} onChangeText={setY} keyboardType="numeric" maxLength={4} />
              <TextInput style={styles.datePartInput} value={m} onChangeText={setM} keyboardType="numeric" maxLength={2} />
              <TextInput style={styles.datePartInput} value={d} onChangeText={setD} keyboardType="numeric" maxLength={2} />
            </View>
            <View style={styles.datePickerActions}>
              <Pressable onPress={onCancel} style={styles.outlineButton}><Text style={styles.outlineButtonText}>Cancel</Text></Pressable>
              <Pressable onPress={confirm} style={styles.primaryButton}><Text style={styles.primaryButtonText}>OK</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const body = (
    <View style={[styles.container, embedded && styles.embeddedContainer, styles.bodyContainer]}>
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
      <ThemedText type="subtitle" style={{ marginBottom: 8, color: DSColors.text.primary }}>Weekly Plan</ThemedText>
      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text>Start Date</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => setShowStartPicker(true)} style={[styles.input, { flex: 1, justifyContent: 'center' }]}>
              <Text style={{ color: planStart ? DSColors.text.primary : DSColors.text.secondary }}>{planStart || 'YYYY-MM-DD'}</Text>
            </Pressable>
            <Pressable onPress={() => { const d = new Date(); setPlanStart(d.toISOString().slice(0,10)); setPlanError(null); }} style={[styles.outlineButton, { marginLeft: 8 }]}>
              <Text style={styles.outlineButtonText}>Today</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text>End Date</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => setShowEndPicker(true)} style={[styles.input, { flex: 1, justifyContent: 'center' }]}>
              <Text style={{ color: planEnd ? DSColors.text.primary : DSColors.text.secondary }}>{planEnd || 'YYYY-MM-DD'}</Text>
            </Pressable>
            <Pressable onPress={() => { const d = new Date(); setPlanEnd(d.toISOString().slice(0,10)); setPlanError(null); }} style={[styles.outlineButton, { marginLeft: 8 }]}>
              <Text style={styles.outlineButtonText}>Today</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <View style={isNarrow ? { width: '100%' } : { width: 160 }}>
          <Text>Sessions / day</Text>
          <TextInput value={sessionsPerDay} onChangeText={(t) => { setSessionsPerDay(t); setPlanError(null); }} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 6 }}>Days of week</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((label, idx) => (
              <Pressable key={label} onPress={() => { const copy = [...daysOfWeek]; copy[idx] = !copy[idx]; setDaysOfWeek(copy); setPlanError(null); }} style={[styles.weekdayChip, daysOfWeek[idx] && styles.weekdayChipActive, { marginBottom: 6 }]}>
                <Text style={[{ fontWeight: '600' }, daysOfWeek[idx] ? { color: DSColors.text.inverse } : { color: DSColors.text.primary }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <DatePickerModal visible={showStartPicker} initial={planStart} onCancel={() => setShowStartPicker(false)} onConfirm={(iso) => { setPlanStart(iso); setShowStartPicker(false); setPlanError(null); }} />
      <DatePickerModal visible={showEndPicker} initial={planEnd} onCancel={() => setShowEndPicker(false)} onConfirm={(iso) => { setPlanEnd(iso); setShowEndPicker(false); setPlanError(null); }} />

      {planError && <ThemedText type="default" style={{ color: DSColors.danger, marginBottom: 8 }}>{planError}</ThemedText>}

      <Text style={{ ...DSTypography.caption, marginBottom: 6 }}>PRESCRIPTION (PHASE 1)</Text>
      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text>Target Flexion (°)</Text>
          <TextInput value={targetFlexion} onChangeText={setTargetFlexion} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text>Target Extension (°)</Text>
          <TextInput value={targetExtension} onChangeText={setTargetExtension} style={styles.input} keyboardType="numeric" />
        </View>
      </View>

      <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text>Speed (1–10)</Text>
          <TextInput value={speedLevel} onChangeText={setSpeedLevel} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text>Duration (min)</Text>
          <TextInput value={durationMinutes} onChangeText={setDurationMinutes} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={isNarrow ? { width: '100%' } : { width: 120 }}>
          <Text>Force Level (1–10)</Text>
          <TextInput value={forceLevel} onChangeText={setForceLevel} style={styles.input} keyboardType="numeric" />
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
      <ThemedView style={[styles.chartCard, isNarrow ? styles.chartCardNarrow : {}]}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: embedded ? 'transparent' : undefined }}>
      <View style={styles.screenShell}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContainer, embedded && styles.embeddedScrollContainer]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {body}
        </ScrollView>

        <View style={[styles.saveFooter, embedded && styles.saveFooterEmbedded]}>
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
    padding: DSLayout.screenPadding,
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
