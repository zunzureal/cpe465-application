/**
 * History (ประวัติ) – Patient-friendly progress screen.
 * Fully themed to DSColors (University Red / Gray palette).
 * Session cards use icons for quick scanning.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
// Chart types from react-native-chart-kit are incompatible with our React typings
// in some environments; provide a local any-typed alias for JSX usage.
const AnyLineChart = LineChart as any;
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPatientSessions } from '@/services/apiClient';
import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';

// ─── Period selector ──────────────────────────────────────────────────────────
type Period = '7d' | '30d' | 'all';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '7d',  label: '7 วัน'   },
  { key: '30d', label: '30 วัน'  },
  { key: 'all', label: 'ทั้งหมด' },
];

function PeriodSelector({ selected, onSelect }: { selected: Period; onSelect: (p: Period) => void }) {
  return (
    <View style={styles.periodRow}>
      {PERIOD_OPTIONS.map(({ key, label }) => (
        <Pressable
          key={key}
          style={[styles.periodTab, selected === key && styles.periodTabActive]}
          onPress={() => onSelect(key)}
        >
          <Text style={[styles.periodTabText, selected === key && styles.periodTabTextActive]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Chart dimensions (fixed once at load — never reactive) ──────────────────
const CHART_WIDTH = Dimensions.get('window').width
  - DSLayout.screenPadding * 2
  - DSLayout.cardPadding * 2;
const CHART_HEIGHT = Math.max(180, Math.min(220, Dimensions.get('window').width * 0.55));

// ─── Chart line colors ────────────────────────────────────────────────────────
const TARGET_LINE_COLOR = '#7DD3FC'; // light-blue dashed target line
const ACTUAL_LINE_COLOR = DSColors.primary; // University Red for actual progress

const SESSIONS_PER_DAY = 3;

// ─── Mock data — multiple sessions per day ────────────────────────────────────
interface SessionRecord {
  id: string;
  date: string;
  time: string;
  ts: number;
  sessionNum: number;
  sessionsPerDay: number;
  achievedFlexion: number;
  targetFlexion: number;
  painLevel: 1 | 2 | 3;
  isManual: boolean;
  dayLabel: string;
  sessionStatus?: 'SUCCESS' | 'CONTINUE' | 'FAILED';
}

function resolveSessionStatus(apiSession: any): 'SUCCESS' | 'CONTINUE' | 'FAILED' {
  const storedStatus = String(apiSession.sessionStatus ?? apiSession.status ?? '').toUpperCase();
  if (storedStatus === 'SUCCESS' || storedStatus === 'CONTINUE' || storedStatus === 'FAILED') {
    return storedStatus;
  }

  if (String(apiSession.plan?.status ?? '').toUpperCase() === 'CANCELLED') {
    return 'FAILED';
  }

  return Number(apiSession.actualMaxFlexion ?? 0) >= Number(apiSession.plan?.targetFlexion ?? 0)
    ? 'SUCCESS'
    : 'CONTINUE';
}

function resolveDisplaySessionStatus(
  sessionStatus?: 'SUCCESS' | 'CONTINUE' | 'FAILED',
  achievedFlexion?: number,
  targetFlexion?: number,
): 'SUCCESS' | 'CONTINUE' | 'FAILED' {
  if (sessionStatus === 'SUCCESS' || sessionStatus === 'CONTINUE' || sessionStatus === 'FAILED') {
    return sessionStatus;
  }

  if (achievedFlexion != null && targetFlexion != null) {
    return achievedFlexion >= targetFlexion ? 'SUCCESS' : 'CONTINUE';
  }

  return 'CONTINUE';
}

// Transform API SessionResponse to SessionRecord
function transformApiSessions(apiSessions: any[]): SessionRecord[] {
  const dayMap = new Map<string, SessionRecord[]>();
  
  apiSessions.forEach((apiSession) => {
    // Skip ghost sessions (started but never performed — no flexion data recorded)
    if (apiSession.durationCompleted === 0 && apiSession.actualMaxFlexion === 0) return;

    const sessionDate = new Date(apiSession.sessionDate);
    const dateStr = sessionDate.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const timeStr = sessionDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const dayLabel = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][sessionDate.getDay()];
    
    // Normalize painLevel coming from session_logs. Backend may store a broader range
    // (e.g., 0, 3, 5, 8). Map them into our UI buckets: 1 (no pain), 2 (moderate), 3 (severe).
    const rawPain = Number(apiSession.painLevel ?? apiSession.pain_level ?? 1);
    let normalizedPain: 1 | 2 | 3 = 1;
    if (isNaN(rawPain) || rawPain <= 1) {
      normalizedPain = 1;
    } else if (rawPain <= 4) {
      normalizedPain = 2;
    } else {
      normalizedPain = 3;
    }

    const sessionStatus = resolveSessionStatus(apiSession);

    const record: SessionRecord = {
      id: String(apiSession.id),
      date: dateStr,
      time: timeStr,
      ts: sessionDate.getTime(),
      sessionNum: 1,
      sessionsPerDay: 3,
      achievedFlexion: apiSession.actualMaxFlexion || 0,
      targetFlexion: apiSession.plan?.targetFlexion || 0,
      painLevel: normalizedPain,
      isManual: apiSession.isCustomUsed || false,
      dayLabel,
      sessionStatus,
    };
    
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, []);
    }
    dayMap.get(dateStr)!.push(record);
  });

  // Update session numbers for sessions on the same day
  const result: SessionRecord[] = [];
  dayMap.forEach((sessions) => {
    // sort by timestamp ascending so session 1 is earliest
    sessions.sort((a, b) => a.ts - b.ts);
    sessions.forEach((session, index) => {
      session.sessionNum = index + 1;
      session.sessionsPerDay = sessions.length;
      result.push(session);
    });
  });
  
  return result;
}

// Keep MOCK_SESSIONS as fallback for development
const MOCK_SESSIONS: SessionRecord[] = [
  // 4 มี.ค. — 3/3 ✓
  { id: '1a', date: '4 มี.ค. 2568', time: '09:30', ts: Date.now(), sessionNum: 1, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 88, targetFlexion: 85, painLevel: 1, isManual: false, dayLabel: 'ศ.' },
  { id: '1b', date: '4 มี.ค. 2568', time: '12:00', ts: Date.now(), sessionNum: 2, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 89, targetFlexion: 85, painLevel: 1, isManual: false, dayLabel: 'ศ.' },
  { id: '1c', date: '4 มี.ค. 2568', time: '15:00', ts: Date.now(), sessionNum: 3, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 90, targetFlexion: 85, painLevel: 2, isManual: false, dayLabel: 'ศ.' },
  // 3 มี.ค. — 2/3
  { id: '2a', date: '3 มี.ค. 2568', time: '09:00', ts: Date.now(), sessionNum: 1, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 85, targetFlexion: 85, painLevel: 2, isManual: true,  dayLabel: 'พฤ.' },
  { id: '2b', date: '3 มี.ค. 2568', time: '13:30', ts: Date.now(), sessionNum: 2, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 84, targetFlexion: 85, painLevel: 2, isManual: false, dayLabel: 'พฤ.' },
  // 2 มี.ค. — 3/3 ✓
  { id: '3a', date: '2 มี.ค. 2568', time: '10:15', ts: Date.now(), sessionNum: 1, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 86, targetFlexion: 85, painLevel: 1, isManual: false, dayLabel: 'พ.' },
  { id: '3b', date: '2 มี.ค. 2568', time: '13:00', ts: Date.now(), sessionNum: 2, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 87, targetFlexion: 85, painLevel: 1, isManual: false, dayLabel: 'พ.' },
  { id: '3c', date: '2 มี.ค. 2568', time: '16:00', ts: Date.now(), sessionNum: 3, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 88, targetFlexion: 85, painLevel: 1, isManual: false, dayLabel: 'พ.' },
  // 1 มี.ค. — 1/3
  { id: '4a', date: '1 มี.ค. 2568', time: '16:45', ts: Date.now(), sessionNum: 1, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 82, targetFlexion: 80, painLevel: 2, isManual: false, dayLabel: 'อ.' },
  // 28 ก.พ. — 3/3 ✓
  { id: '5a', date: '28 ก.พ. 2568', time: '09:00', ts: Date.now(), sessionNum: 1, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 78, targetFlexion: 75, painLevel: 1, isManual: false, dayLabel: 'จ.' },
  { id: '5b', date: '28 ก.พ. 2568', time: '12:00', ts: Date.now(), sessionNum: 2, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 79, targetFlexion: 75, painLevel: 1, isManual: true,  dayLabel: 'จ.' },
  { id: '5c', date: '28 ก.พ. 2568', time: '15:30', ts: Date.now(), sessionNum: 3, sessionsPerDay: SESSIONS_PER_DAY, achievedFlexion: 80, targetFlexion: 75, painLevel: 1, isManual: false, dayLabel: 'จ.' },
];

// Hidden flag to force mock data (useful for offline/manual testing).
// Set environment variable `EXPO_PUBLIC_FORCE_MOCK_SESSIONS=1` to enable.
const FORCE_MOCK = process.env.EXPO_PUBLIC_FORCE_MOCK_SESSIONS === '1';

// Group sessions by date for display
interface DayGroup {
  date: string;
  dayLabel: string;
  sessions: SessionRecord[];
}
function groupByDay(sessions: SessionRecord[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of sessions) {
    if (!map.has(s.date)) {
      map.set(s.date, { date: s.date, dayLabel: s.dayLabel, sessions: [] });
    }
    map.get(s.date)!.sessions.push(s);
  }
  return Array.from(map.values());
}

const PAIN_CONFIG: Record<1 | 2 | 3, { emoji: string; label: string; color: string }> = {
  1: { emoji: '😃', label: 'ไม่เจ็บ',  color: DSColors.success },
  2: { emoji: '😐', label: 'ปานกลาง', color: DSColors.warning },
  3: { emoji: '😫', label: 'เจ็บมาก', color: DSColors.danger },
};

const SESSION_STATUS_CONFIG: Record<'SUCCESS' | 'CONTINUE' | 'FAILED', string> = {
  SUCCESS: DSColors.success,
  CONTINUE: DSColors.warning,
  FAILED: DSColors.danger,
};

// ─── Chart config ─────────────────────────────────────────────────────────────
const makeChartConfig = (labelColor: string, gridColor: string) => ({
  backgroundColor: DSColors.surface,
  backgroundGradientFrom: DSColors.surface,
  backgroundGradientTo: DSColors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(160,0,0,${opacity * 0.25})`, // brand-red tint for grid dots
  labelColor: () => labelColor,
  style: { borderRadius: 16 },
  propsForLabels: { fontSize: 13, fontWeight: '600' as const },
  propsForBackgroundLines: { stroke: gridColor, strokeWidth: 0.6 },
  fillShadowGradient: DSColors.primary,
  fillShadowGradientOpacity: 0.08,
});

// ─── Session card component ───────────────────────────────────────────────────

interface SessionCardProps {
  time: string;
  sessionNum: number;
  sessionsPerDay: number;
  achievedFlexion: number;
  targetFlexion: number;
  painLevel: 1 | 2 | 3;
  isManual: boolean;
  sessionStatus?: 'SUCCESS' | 'CONTINUE' | 'FAILED';
}

function SessionCard({ time, sessionNum, sessionsPerDay, achievedFlexion, targetFlexion, painLevel, isManual, sessionStatus }: SessionCardProps) {
  const exceeded = achievedFlexion >= targetFlexion;
  // Ensure we always have a valid pain config (fallback to 1 = 'ไม่เจ็บ')
  const pain = PAIN_CONFIG[painLevel as 1 | 2 | 3] ?? PAIN_CONFIG[1];
  const resolvedStatus = resolveDisplaySessionStatus(sessionStatus, achievedFlexion, targetFlexion);
  const statusColor = SESSION_STATUS_CONFIG[resolvedStatus] ?? DSColors.warning;

  return (
    <View style={styles.card}>
      {/* Top row: session number + time + mode badge */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardDateRow}>
          <View style={styles.sessionNumBadge}>
            <Text style={styles.sessionNumText}>ครั้งที่ {sessionNum}</Text>
          </View>
          <Ionicons name="time-outline" size={13} color={DSColors.text.secondary} />
          <Text style={styles.cardDateTime}>{time} น.</Text>
        </View>
        <View style={[styles.badge, isManual ? styles.badgeManual : styles.badgeDoctor]}>
          <Ionicons
            name={isManual ? 'person-outline' : 'medical-outline'}
            size={12}
            color={isManual ? DSColors.warning : DSColors.success}
          />
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {resolvedStatus === 'SUCCESS' ? 'สำเร็จ' : resolvedStatus === 'FAILED' ? 'ล้มเหลว' : 'กำลังดำเนินการ'}
          </Text>
        </View>
      </View>

      {/* Middle: metric chips */}
      <View style={styles.metricRow}>
        {/* Achieved */}
        <View style={[styles.metricChip, styles.metricChipPrimary]}>
          <Ionicons name="trending-up" size={18} color={DSColors.primary} />
          <Text style={styles.metricChipLabel}>ทำได้จริง</Text>
          <Text style={styles.metricChipValue}>{achievedFlexion}°</Text>
        </View>

        {/* Divider arrow */}
        <View style={styles.metricArrow}>
          <Ionicons
            name={exceeded ? 'checkmark-circle' : 'arrow-forward'}
            size={22}
            color={exceeded ? DSColors.success : DSColors.text.secondary}
          />
        </View>

        {/* Target */}
        <View style={[styles.metricChip, styles.metricChipTarget]}>
          <Ionicons name="flag-outline" size={18} color={DSColors.text.secondary} />
          <Text style={styles.metricChipLabel}>เป้าหมาย</Text>
          <Text style={[styles.metricChipValue, { color: DSColors.text.secondary }]}>{targetFlexion}°</Text>
        </View>
      </View>

      {/* Bottom: pain level */}
      <View style={styles.painRow}>
        <Ionicons name="pulse-outline" size={16} color={DSColors.text.secondary} />
        <Text style={styles.painRowLabel}>ความเจ็บปวด</Text>
        <Text style={styles.painEmoji}>{pain.emoji}</Text>
        <Text style={[styles.painLevelText, { color: pain.color }]}>{pain.label}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const auth = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('7d');

  // Fetch sessions from API when component mounts or patientId changes
  useEffect(() => {
    async function loadSessions() {
      // If developer explicitly requests mock data, skip API and use local mock.
      if (FORCE_MOCK) {
        setSessions(MOCK_SESSIONS);
        setIsLoading(false);
        return;
      }

      if (!auth.patientId) {
        setError('Patient ID not found');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      try {
        const response = await getPatientSessions(auth.patientId);
        if (response.success && response.data) {
          const transformed = transformApiSessions(response.data);
          setSessions(transformed);
        } else {
          setError(response.error || 'Failed to fetch sessions');
          // Fall back to mock data if fetch fails
          setSessions(MOCK_SESSIONS);
        }
      } catch (err) {
        console.error('Error loading sessions:', err);
        setError('Failed to load session history');
        // Fall back to mock data
        setSessions(MOCK_SESSIONS);
      } finally {
        setIsLoading(false);
      }
    }

    loadSessions();
  }, [auth.patientId]);

  // displaySessions: filtered by period — drives summary stats + session list
  const displaySessions = useMemo(() => {
    const base = isLoading ? [] : (sessions.length > 0 ? sessions : MOCK_SESSIONS);
    if (selectedPeriod === 'all') return base;
    const days = selectedPeriod === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return base.filter((s) => s.ts >= cutoff);
  }, [isLoading, sessions, selectedPeriod]);
  const dayGroups = useMemo(() => groupByDay(displaySessions), [displaySessions]);

  const Y_FLOOR = 50;
  const Y_CEILING = 130;
  const MAX_CHART_POINTS = 10;

  const chartData = useMemo(() => {
    if (dayGroups.length === 0) return null;
    const reversedGroups = [...dayGroups.slice(0, MAX_CHART_POINTS)].reverse();

    const labels = reversedGroups.map((g) => {
      const d = new Date(g.sessions[0].ts);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const actualValues = reversedGroups.map((g) => Math.max(...g.sessions.map((s) => s.achievedFlexion)));
    const targetValues = reversedGroups.map((g) => g.sessions[0].targetFlexion);

    return {
      labels,
      datasets: [
        { data: reversedGroups.map(() => Y_FLOOR),   color: (): string => 'rgba(0,0,0,0)', strokeWidth: 0 },
        { data: reversedGroups.map(() => Y_CEILING), color: (): string => 'rgba(0,0,0,0)', strokeWidth: 0 },
        { data: targetValues, color: (): string => TARGET_LINE_COLOR, strokeWidth: 2, strokeDashArray: [6, 4] },
        { data: actualValues, color: (): string => ACTUAL_LINE_COLOR, strokeWidth: 3 },
      ],
    };
  }, [dayGroups]);

  const totalSessions = displaySessions.length;
  const totalDays = dayGroups.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <PeriodSelector selected={selectedPeriod} onSelect={setSelectedPeriod} />

        {/* ── Summary banner ─────────────────────────────────────────────── */}
        <View style={[styles.summaryCard, DSShadow]}>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="trophy" size={28} color={DSColors.primary} />
          </View>
          <View style={styles.summaryTexts}>
            <Text style={styles.summaryText}>
              เยี่ยมมาก! ทำ {totalSessions} ครั้ง ใน {totalDays} วัน
              {selectedPeriod === '7d' ? ' (7 วันล่าสุด)' : selectedPeriod === '30d' ? ' (30 วันล่าสุด)' : ''}
            </Text>
            <Text style={styles.summarySub}>
              {totalSessions} sessions across {totalDays} days.
            </Text>
          </View>
        </View>

        {/* ── Progress chart ─────────────────────────────────────────────── */}
        <View style={[styles.chartCard, DSShadow]}>
          <View style={styles.chartTitleRow}>
            <Ionicons name="analytics" size={20} color={DSColors.primary} />
            <Text style={styles.chartTitle}>พัฒนาการการงอเข่า</Text>
          </View>
          <Text style={styles.chartSubtitle}>Flexion Progress</Text>

          {isLoading || !chartData ? (
            <View style={[styles.chartPlaceholder, { height: CHART_HEIGHT }]}>
              {isLoading
                ? <ActivityIndicator size="large" color={DSColors.primary} />
                : <Text style={styles.chartNoData}>ยังไม่มีข้อมูลการออกกำลังกาย</Text>
              }
            </View>
          ) : (
            <AnyLineChart
              data={chartData}
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              yAxisLabel=""
              fromZero={false}
              withInnerLines
              withOuterLines
              chartConfig={makeChartConfig(DSColors.text.secondary, DSColors.borderLight)}
              style={styles.chart}
              withDots
              withVerticalLabels
              withHorizontalLabels
              segments={5}
              formatYLabel={(v: string) => `${Math.round(Number(v))}°`}
            />
          )}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDash, { backgroundColor: TARGET_LINE_COLOR }]} />
              <Text style={styles.legendText}>เป้าหมายแพทย์</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: ACTUAL_LINE_COLOR }]} />
              <Text style={styles.legendText}>ที่คุณทำได้จริง</Text>
            </View>
          </View>
        </View>

        {/* ── Session list (grouped by day) ──────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={18} color={DSColors.primary} />
          <Text style={styles.sectionLabel}>เซสชันที่ผ่านมา</Text>
        </View>

        {dayGroups.map((group) => {
          const completed = group.sessions.length;
          const perDay = group.sessions[0].sessionsPerDay;
          const allDone = completed >= perDay;
          return (
            <View key={group.date} style={styles.dayGroup}>
              {/* Day header */}
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Ionicons name="calendar-outline" size={15} color={DSColors.text.secondary} />
                  <Text style={styles.dayHeaderDate}>{group.date}</Text>
                </View>
                <View style={styles.dayHeaderRight}>
                  {Array.from({ length: perDay }, (_, i) => {
                    const sessionForIndex = group.sessions[i];
                    const dotStatus = resolveDisplaySessionStatus(
                      sessionForIndex?.sessionStatus,
                      sessionForIndex?.achievedFlexion,
                      sessionForIndex?.targetFlexion,
                    );
                    const dotStyle = sessionForIndex
                      ? dotStatus === 'SUCCESS'
                        ? styles.dayDotDone
                        : dotStatus === 'FAILED'
                          ? styles.dayDotFailed
                          : styles.dayDotInProgress
                      : styles.dayDotEmpty;

                    return <View key={i} style={[styles.dayDot, dotStyle]} />;
                  })}
                  <Text style={[styles.dayHeaderCount, allDone && styles.dayHeaderCountDone]}>
                    {completed}/{perDay}
                  </Text>
                </View>
              </View>
              {/* Session cards for this day */}
              {group.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  time={session.time}
                  sessionNum={session.sessionNum}
                  sessionsPerDay={session.sessionsPerDay}
                  achievedFlexion={session.achievedFlexion}
                  targetFlexion={session.targetFlexion}
                  painLevel={session.painLevel}
                  isManual={session.isManual}
                  sessionStatus={session.sessionStatus}
                />
              ))}
            </View>
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  content: {
    padding: DSLayout.screenPadding,
    paddingBottom: 40,
  },

  // ── Summary banner ──────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: DSColors.primaryLight,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.sectionGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: DSColors.primary + '30',
  },
  summaryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryTexts: { flex: 1 },
  summaryText: {
    ...DSTypography.bodyBold,
    color: DSColors.primaryDark,
    lineHeight: 22,
  },
  summarySub: {
    ...DSTypography.caption,
    color: DSColors.primary,
    marginTop: 2,
  },

  // ── Chart card ──────────────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.sectionGap,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  chartTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
  },
  chartSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 16,
  },
  chart: {
    borderRadius: DSShape.radiusButton,
    alignSelf: 'stretch',
  },
  chartPlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartNoData: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  legendDash: {
    width: 24,
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  legendText: {
    ...DSTypography.captionBold,
    color: DSColors.text.secondary,
  },

  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionLabel: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },

  // ── Session card ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.itemGap,
    borderWidth: 1,
    borderColor: DSColors.borderLight,
    ...({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    } as object),
  },
  // Day group + header
  dayGroup: {
    marginBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 6,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayHeaderDate: {
    fontSize: 14,
    fontWeight: '700',
    color: DSColors.text.primary,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dayDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dayDotDone: {
    backgroundColor: DSColors.success,
  },
  dayDotInProgress: {
    backgroundColor: DSColors.warning,
  },
  dayDotFailed: {
    backgroundColor: DSColors.danger,
  },
  dayDotEmpty: {
    backgroundColor: DSColors.borderLight,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  dayHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: DSColors.text.secondary,
    marginLeft: 2,
  },
  dayHeaderCountDone: {
    color: DSColors.success,
  },
  // Session number badge
  sessionNumBadge: {
    backgroundColor: DSColors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sessionNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: DSColors.primary,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardDateTime: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DSShape.radiusChip,
  },
  badgeDoctor: {
    backgroundColor: DSColors.successLight,
  },
  badgeManual: {
    backgroundColor: DSColors.warningLight,
  },
  badgeText: {
    ...DSTypography.small,
    fontWeight: '700',
  },

  // Metric chips
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  metricChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: DSShape.radiusButton,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  metricChipPrimary: {
    backgroundColor: DSColors.primaryLight,
  },
  metricChipTarget: {
    backgroundColor: DSColors.background,
  },
  metricChipLabel: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
  },
  metricChipValue: {
    ...DSTypography.data,
    color: DSColors.primary,
  },
  metricArrow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  // Pain row
  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
  },
  painRowLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    flex: 1,
  },
  painEmoji: {
    fontSize: 22,
  },
  painLevelText: {
    ...DSTypography.captionBold,
  },

  bottomSpacer: { height: 24 },

  // ── Period selector ─────────────────────────────────────────────────────────
  periodRow: {
    flexDirection: 'row',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusChip,
    padding: 4,
    marginBottom: DSLayout.itemGap,
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
