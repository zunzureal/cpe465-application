/**
 * Patient Home Dashboard – Prescription fetch + Scenario A/B + Calendar.
 *
 * Scenario A (hasPlan): show goal icons (Angle / Duration / Force) from API.
 * Scenario B (noPlan):  friendly empty-state + "เข้าสู่โหมดฝึกอิสระ" CTA.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const IMG_KNEE = require('@/assets/images/knee.png');

import { SafeAreaView } from 'react-native-safe-area-context';

import { DeviceConnectionModal } from '@/components/ui/DeviceConnectionModal';
import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useMockDeviceConnection } from '@/hooks/useMockDeviceConnection';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPatientPreset,
  getPatientSessions,
  getPatientTodayStats,
  type SessionResponse,
  type TodayStatsResponse,
} from '@/services/apiClient';

// MVP only treats knees. Hardcode for now; later swap for plan.bodyPart from API.
const BODY_PART_TH = 'เข่าขวา';
const BODY_PART_EN = 'Right Knee';

interface TodayPlan {
  targetFlexion: number;
  durationMinutes: number;
  targetForceN: number;
  sessionsPerDay: number;
  sessionsCompletedToday: number;
}

type PlanState = 'loading' | 'hasPlan' | 'noPlan';
type SessionStatus = 'SUCCESS' | 'CONTINUE' | 'FAILED';

// ─── Calendar widget ──────────────────────────────────────────────────────────

/** Maps date string (YYYY-MM-DD) → sessions completed that day (1 – 3). Only include days with actual activity. */
const MOCK_SESSION_COUNTS: Record<string, number> = {
  '2026-04-01': 3, '2026-04-03': 2, '2026-04-05': 1,
  '2026-04-07': 3, '2026-04-08': 3, '2026-04-09': 2,
  '2026-04-10': 3, '2026-04-11': 1, '2026-04-12': 3,
  '2026-04-14': 2, '2026-04-15': 3, '2026-04-17': 1,
  '2026-04-19': 3, '2026-04-21': 3, '2026-04-22': 2,
  '2026-04-24': 3, '2026-04-26': 3, '2026-04-28': 2,
  '2026-05-01': 3, '2026-05-02': 1, '2026-05-03': 2,
  '2026-05-05': 1,
};

/** Set of YYYY-MM-DD strings that are doctor-prescribed rest days. */
const MOCK_REST_DAYS = new Set([
  '2026-04-02', '2026-04-04', '2026-04-06',
  '2026-04-13', '2026-04-16', '2026-04-20',
  '2026-04-25', '2026-04-27',
  '2026-05-04', '2026-05-09', '2026-05-10',
]);

const SESSIONS_PER_DAY = 3;

// ─── Weekly plan mock ─────────────────────────────────────────────────────────
/** Maps YYYY-MM-DD → { scheduled: bool, sessionsCompleted: number } */
interface DayPlan {
  scheduled: boolean;
  sessionsCompleted: number;
  sessionStatuses: SessionStatus[];
}
const MOCK_WEEKLY_PLAN: Record<string, DayPlan> = {
  '2026-05-04': { scheduled: true,  sessionsCompleted: 3, sessionStatuses: ['SUCCESS', 'SUCCESS', 'SUCCESS'] },
  '2026-05-05': { scheduled: true,  sessionsCompleted: 2, sessionStatuses: ['SUCCESS', 'CONTINUE'] },
  '2026-05-06': { scheduled: true,  sessionsCompleted: 1, sessionStatuses: ['FAILED'] },
  '2026-05-07': { scheduled: true,  sessionsCompleted: 0, sessionStatuses: [] },
  '2026-05-08': { scheduled: true,  sessionsCompleted: 0, sessionStatuses: [] },
  '2026-05-09': { scheduled: false, sessionsCompleted: 0, sessionStatuses: [] },
  '2026-05-10': { scheduled: false, sessionsCompleted: 0, sessionStatuses: [] },
};

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildSessionCountsByDate(sessions: SessionResponse[]): Record<string, number> {
  return sessions.reduce<Record<string, number>>((acc, session) => {
    const key = toDateKey(new Date(session.sessionDate));
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildSessionStatusesByDate(sessions: SessionResponse[]): Record<string, SessionStatus[]> {
  return sessions.reduce<Record<string, SessionStatus[]>>((acc, session) => {
    const key = toDateKey(new Date(session.sessionDate));
    const status =
      session.sessionStatus === 'SUCCESS' || session.sessionStatus === 'CONTINUE' || session.sessionStatus === 'FAILED'
        ? session.sessionStatus
        : session.plan?.status === 'CANCELLED'
          ? 'FAILED'
          : session.actualMaxFlexion >= (session.plan?.targetFlexion ?? 0)
            ? 'SUCCESS'
            : 'CONTINUE';
    if (!acc[key]) acc[key] = [];
    acc[key].push(status);
    return acc;
  }, {});
}

function buildWeeklyPlanFromCounts(
  sessionCountsByDate: Record<string, number>,
  sessionStatusesByDate: Record<string, SessionStatus[]>,
  hasActivePlan: boolean,
): Record<string, DayPlan> {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = toDateKey(d);
    const completed = sessionCountsByDate[key] ?? 0;
    const scheduled = completed > 0 || (d >= today && hasActivePlan);
    return [
      key,
      {
        scheduled,
        sessionsCompleted: Math.min(completed, SESSIONS_PER_DAY),
        sessionStatuses: (sessionStatusesByDate[key] ?? []).slice(0, SESSIONS_PER_DAY),
      },
    ] as const;
  }).reduce<Record<string, DayPlan>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

interface CalendarWidgetProps {
  sessionStatusesByDate: Record<string, SessionStatus[]>;
  restDays: Set<string>;
}

function CalendarWidget({ sessionStatusesByDate, restDays }: CalendarWidgetProps) {
  const today = new Date();
  const [display, setDisplay] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = display.getFullYear();
  const month = display.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dateKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getStatuses = (d: number) => sessionStatusesByDate[dateKey(d)] ?? [];
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  const isFuture = (d: number) => new Date(year, month, d) > today;
  const isRest = (d: number) => restDays.has(dateKey(d));

  // Summary counts for the month header
  const daysWithSessions = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .filter(d => getStatuses(d).length > 0).length;
  const totalSessions = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .reduce((sum, d) => sum + getStatuses(d).length, 0);

  const flatCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (flatCells.length % 7 !== 0) flatCells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < flatCells.length; i += 7) {
    rows.push(flatCells.slice(i, i + 7));
  }

  const prevMonth = () => setDisplay(new Date(year, month - 1, 1));
  const nextMonth = () => setDisplay(new Date(year, month + 1, 1));

  const renderDay = (d: number | null, colIdx: number) => {
    if (!d) return <View key={`e-${colIdx}`} style={calStyles.cell} />;

    const statuses = getStatuses(d);
    const todayFlag = isToday(d);
    const future = isFuture(d);
    const restDay = !future && !todayFlag && isRest(d);

    const numColor = todayFlag
      ? '#FFFFFF'
      : future
      ? DSColors.text.secondary
      : DSColors.secondary;

    return (
      <View key={d} style={[calStyles.cell, todayFlag && calStyles.cellToday, restDay && calStyles.cellRest]}>
        {/* Day number — today gets a red filled circle */}
        <View style={[calStyles.dayNumWrap, todayFlag && calStyles.dayNumWrapToday]}>
          <Text style={[
            calStyles.dayNum,
            { color: numColor },
            !todayFlag && future && calStyles.dayNumFuture,
          ]}>
            {d}
          </Text>
        </View>

        {/* Status: rest / dots / placeholder */}
        {future ? (
          <View style={calStyles.dotsRowPlaceholder} />
        ) : restDay ? (
          <Text style={calStyles.restLabel}>หยุด</Text>
        ) : (
          <View style={calStyles.dotsRow}>
            {Array.from({ length: SESSIONS_PER_DAY }, (_, i) => (
              <View
                key={i}
                style={[
                  calStyles.dot,
                  statuses[i] === 'SUCCESS'
                    ? calStyles.dotDone
                    : statuses[i] === 'FAILED'
                      ? calStyles.dotFailed
                      : statuses[i] === 'CONTINUE'
                        ? calStyles.dotProgress
                        : calStyles.dotEmpty,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View>
      {/* Month navigator */}
      <View style={calStyles.navRow}>
        <Pressable onPress={prevMonth} hitSlop={8} style={calStyles.navBtn}
          accessibilityLabel="เดือนก่อนหน้า">
          <Ionicons name="chevron-back" size={22} color={DSColors.primary} />
        </Pressable>
        <View style={calStyles.navCenter}>
          <Text style={calStyles.monthTitle}>
            {THAI_MONTHS[month]} {year + 543}
          </Text>
          <Text style={calStyles.completedCount}>
            ทำแล้ว {daysWithSessions} วัน · {totalSessions} เซสชัน
          </Text>
        </View>
        <Pressable onPress={nextMonth} hitSlop={8} style={calStyles.navBtn}
          accessibilityLabel="เดือนถัดไป">
          <Ionicons name="chevron-forward" size={22} color={DSColors.primary} />
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={calStyles.headerRow}>
        {DAY_HEADERS.map((h) => (
          <Text key={h} style={calStyles.headerCell}>
            {h}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={calStyles.gridRow}>
          {row.map((d, colIdx) => renderDay(d, colIdx))}
        </View>
      ))}

      {/* Legend */}
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={calStyles.legendDotGroup}>
            {[0,1,2].map(i => <View key={i} style={[calStyles.dot, calStyles.dotDone]} />)}
          </View>
          <Text style={calStyles.legendText}>ครบแล้ว</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={calStyles.legendDotGroup}>
            {[0,1,2].map(i => <View key={i} style={[calStyles.dot, calStyles.dotEmpty]} />)}
          </View>
          <Text style={calStyles.legendText}>ไม่ทำ</Text>
        </View>
        <View style={calStyles.legendItem}>
          <Text style={[calStyles.restLabel, { fontSize: 10 }]}>หยุด</Text>
          <Text style={calStyles.legendText}>วันหยุด</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dayNumWrap, calStyles.dayNumWrapToday, { width: 18, height: 18, borderRadius: 9 }]} />
          <Text style={calStyles.legendText}>วันนี้</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Weekly plan strip ───────────────────────────────────────────────────────

const WEEK_DAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function WeeklyPlanStrip({
  weekPlan,
  sessionsPerDay,
}: {
  weekPlan: Record<string, DayPlan>;
  sessionsPerDay: number;
}) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build Mon–Sun of current week (week starts Mon)
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = key === todayKey;
    const isPast = d < today && !isToday;
    const isFuture = d > today;
    const plan = weekPlan[key] ?? { scheduled: false, sessionsCompleted: 0 };
    return { d, key, isToday, isPast, isFuture, plan, dayName: WEEK_DAY_SHORT[d.getDay()] };
  });

  return (
    <View style={weekStyles.container}>
      <View style={weekStyles.headerRow}>
        <Ionicons name="calendar-outline" size={16} color={DSColors.primary} />
        <Text style={weekStyles.title}>แผนสัปดาห์นี้</Text>
      </View>
      <View style={weekStyles.strip}>
        {days.map(({ d, key, isToday, isPast, isFuture, plan, dayName }) => {
          const noActivity = !plan.scheduled && plan.sessionsCompleted === 0;
          return (
            <View
              key={key}
              style={[
                weekStyles.dayCell,
                isToday && weekStyles.dayCellToday,
                noActivity && weekStyles.dayCellInactive,
              ]}
            >
              {/* Day name */}
              <Text style={[weekStyles.dayName, isToday && weekStyles.dayNameToday]}>
                {dayName}
              </Text>

              {/* Date number */}
              <View style={[weekStyles.dateCircle, isToday && weekStyles.dateCircleToday]}>
                <Text style={[weekStyles.dateNum, isToday && weekStyles.dateNumToday]}>
                  {d.getDate()}
                </Text>
              </View>

              {/* Status indicator */}
              {noActivity ? (
                <Text style={weekStyles.restLabel}>หยุด</Text>
              ) : isFuture && plan.scheduled ? (
                <View style={weekStyles.plannedPips}>
                  {Array.from({ length: sessionsPerDay }, (_, i) => (
                    <View key={i} style={[weekStyles.pip, weekStyles.pipPlanned]} />
                  ))}
                </View>
              ) : (
                <View style={weekStyles.plannedPips}>
                  {Array.from({ length: sessionsPerDay }, (_, i) => {
                    const status = plan.sessionStatuses[i];
                    return (
                      <View
                        key={i}
                        style={[
                          weekStyles.pip,
                          status === 'SUCCESS'
                            ? weekStyles.pipDone
                            : status === 'FAILED'
                              ? weekStyles.pipFailed
                              : status === 'CONTINUE'
                                ? weekStyles.pipProgress
                                : weekStyles.pipEmpty,
                        ]}
                      />
                    );
                  })}
                </View>
              )}

              {/* Status label */}
              {isToday && !noActivity && (
                <Text style={weekStyles.todayLabel}>วันนี้</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={weekStyles.legend}>
        <View style={weekStyles.legendItem}>
          <View style={[weekStyles.pip, weekStyles.pipDone]} />
          <Text style={weekStyles.legendText}>ทำแล้ว</Text>
        </View>
        <View style={weekStyles.legendItem}>
          <View style={[weekStyles.pip, weekStyles.pipProgress]} />
          <Text style={weekStyles.legendText}>กำลังดำเนินการ</Text>
        </View>
        <View style={weekStyles.legendItem}>
          <View style={[weekStyles.pip, weekStyles.pipFailed]} />
          <Text style={weekStyles.legendText}>ล้มเหลว</Text>
        </View>
        <View style={weekStyles.legendItem}>
          <View style={[weekStyles.pip, weekStyles.pipPlanned]} />
          <Text style={weekStyles.legendText}>มีแผน</Text>
        </View>
        <View style={weekStyles.legendItem}>
          <View style={[weekStyles.pip, weekStyles.pipEmpty]} />
          <Text style={weekStyles.legendText}>ยังไม่ทำ</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Goal icon chip ───────────────────────────────────────────────────────────

interface GoalChipProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  muted?: boolean;
}

function GoalChip({ iconName, label, value, muted = false }: GoalChipProps) {
  return (
    <View style={styles.goalChip}>
      <View style={[styles.goalChipIconWrap, muted && styles.goalChipIconWrapMuted]}>
        <Ionicons name={iconName} size={28} color={muted ? DSColors.text.secondary : DSColors.primary} />
      </View>
      <Text style={[styles.goalChipLabel, muted && styles.textMuted]}>{label}</Text>
      <Text style={[styles.goalChipValue, muted && styles.goalChipValueMuted]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function PatientHomeDashboard() {
  const router = useRouter();
  const {
    visible: deviceModalVisible,
    status: deviceStatus,
    startMockConnection,
    selectDiscoveredDevice,
    dismiss: dismissDeviceModal,
    canDismiss: deviceModalCanDismiss,
  } = useMockDeviceConnection();

  const [planState, setPlanState] = useState<PlanState>('loading');
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [sessionCountsByDate, setSessionCountsByDate] = useState<Record<string, number>>({});
  const [sessionStatusesByDate, setSessionStatusesByDate] = useState<Record<string, SessionStatus[]>>({});
  const [weeklyPlan, setWeeklyPlan] = useState<Record<string, DayPlan>>({});
  const { patientId } = useAuth();

  useEffect(() => {
    if (!patientId) {
      setPlanState('noPlan');
      setSessionCountsByDate({});
      setSessionStatusesByDate({});
      setWeeklyPlan({});
      return;
    }

    let cancelled = false;
    setPlanState('loading');

    // Fetch treatment plan, today's stats, and session history in parallel
    Promise.all([
      getPatientPreset(patientId),
      getPatientTodayStats(patientId),
      getPatientSessions(patientId, { limit: 500 }),
    ])
      .then(([presetResponse, statsResponse, sessionsResponse]) => {
        if (cancelled) return;

        if (!presetResponse.success) {
          setPlanState('noPlan');
          setSessionCountsByDate({});
          setSessionStatusesByDate({});
          setWeeklyPlan({});
          return;
        }

        const preset = presetResponse.data;
        const stats = statsResponse.success ? (statsResponse.data as TodayStatsResponse) : null;

        setTodayPlan({
          targetFlexion: Number(preset?.targetFlexion ?? 90),
          durationMinutes: Number(preset?.durationMinutes ?? 15),
          targetForceN: typeof preset?.targetForceN === 'number' ? preset.targetForceN : 10,
          sessionsPerDay: stats?.totalSessionsTarget ?? 3,
          sessionsCompletedToday: stats?.sessionsCompleted ?? 0,
        });

        const counts = sessionsResponse.success && sessionsResponse.data
          ? buildSessionCountsByDate(sessionsResponse.data)
          : {};
        const statuses = sessionsResponse.success && sessionsResponse.data
          ? buildSessionStatusesByDate(sessionsResponse.data)
          : {};
        setSessionCountsByDate(counts);
        setSessionStatusesByDate(statuses);
        setWeeklyPlan(
          buildWeeklyPlanFromCounts(
            counts,
            statuses,
            ['ACTIVE', 'IN_PROGRESS'].includes(String((preset as { status?: string } | undefined)?.status ?? '').toUpperCase()),
          ),
        );
        setPlanState('hasPlan');
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[PatientHomeDashboard] Fetch error:', err);
          setPlanState('noPlan');
          setSessionCountsByDate({});
          setSessionStatusesByDate({});
          setWeeklyPlan({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const renderPlanCard = () => {
    if (planState === 'loading') {
      return (
        <View style={[styles.loadingCard, DSShadow]}>
          <ActivityIndicator size="large" color={DSColors.primary} />
          <Text style={styles.loadingText}>กำลังโหลดแผนการรักษา...</Text>
        </View>
      );
    }

    if (planState === 'noPlan') {
      return (
        <View style={[styles.emptyStateCard, DSShadow]}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={52} color={DSColors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            คุณหมอยังไม่ได้กำหนด{'\n'}แผนการรักษาในวันนี้
          </Text>
          <Text style={styles.emptySub}>No prescription for today</Text>
          <Pressable
            style={({ pressed }) => [styles.manualBigBtn, pressed && { opacity: 0.88 }]}
            onPress={() => startMockConnection(() => router.push('/manual-setup'))}
            accessibilityLabel="เข้าสู่โหมดฝึกอิสระ"
          >
            <Ionicons name="play-circle" size={28} color={DSColors.text.inverse} />
            <Text style={styles.manualBigBtnText}>เข้าสู่โหมดฝึกอิสระ</Text>
          </Pressable>
        </View>
      );
    }

    // Scenario A — has plan
    const plan = todayPlan!;
    const todayKey = toDateKey(new Date());
    const todayStatuses = sessionStatusesByDate[todayKey] ?? [];
    const hasInProgressSessionToday = todayStatuses.includes('CONTINUE');
    const nextSession = hasInProgressSessionToday
      ? Math.max(1, plan.sessionsCompletedToday)
      : plan.sessionsCompletedToday + 1;
    const allDone = plan.sessionsCompletedToday >= plan.sessionsPerDay;

    return (
      <Pressable
        disabled={allDone}
        style={({ pressed }) => [
          styles.startSessionCard,
          DSShadow,
          allDone && styles.startSessionCardDone,
          !allDone && pressed && styles.startSessionCardPressed,
        ]}
        onPress={() => startMockConnection(() => router.push('/therapy-session'))}
        accessibilityLabel={allDone ? 'ทำครบทุกเซสชันแล้ว' : 'เริ่มเซสชันกายภาพบำบัด'}
      >
        <View style={styles.startSessionHeader}>
          <View style={[styles.kneeImageWrap, allDone && styles.kneeImageWrapDone]}>
            <Image
              source={IMG_KNEE}
              style={[styles.kneeImage, allDone && styles.kneeImageDone]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.startSessionTitle, allDone && styles.textMuted]}>
            แผนการรักษาวันนี้
          </Text>
          <Text style={[styles.bodyPartText, allDone && styles.textMuted]}>
            {BODY_PART_TH}  ·  {BODY_PART_EN}
          </Text>
        </View>

        {/* Goal chips — 4 chips in one row */}
        <View style={[styles.goalRow, allDone && styles.goalRowDone]}>
          <GoalChip
            iconName="flag-outline"
            label="เป้าหมายองศา"
            value={`${plan.targetFlexion}°`}
            muted={allDone}
          />
          <View style={styles.goalDivider} />
          <GoalChip
            iconName="time"
            label="ระยะเวลา"
            value={`${plan.durationMinutes} นาที`}
            muted={allDone}
          />
          <View style={styles.goalDivider} />
          <GoalChip
            iconName="barbell"
            label="แรงจำกัด"
            value={`${plan.targetForceN} N`}
            muted={allDone}
          />
          <View style={styles.goalDivider} />
          {/* Session progress chip */}
          <View style={styles.goalChip}>
            <View style={[styles.goalChipIconWrap, allDone && styles.goalChipIconWrapMuted]}>
              <View style={styles.sessionPipsWrap}>
                {Array.from({ length: plan.sessionsPerDay }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.sessionPip,
                      i < plan.sessionsCompletedToday
                        ? styles.sessionPipDone
                        : styles.sessionPipEmpty,
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={[styles.goalChipLabel, allDone && styles.textMuted]}>ทำแล้ว</Text>
            <Text style={[styles.goalChipValue, allDone && styles.goalChipValueMuted]}>
              {plan.sessionsCompletedToday}/{plan.sessionsPerDay}
            </Text>
          </View>
        </View>

        {/* CTA — green success state when done, primary when active */}
        <View style={[styles.startSessionCta, allDone ? styles.startSessionCtaDone : styles.startSessionCtaActive]}>
          {allDone ? (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.startSessionCtaText}>ทำครบทุกเซสชันแล้ว</Text>
            </>
          ) : (
            <>
              <Text style={styles.startSessionCtaText}>
                {hasInProgressSessionToday ? `ทำต่อครั้งที่ ${nextSession}` : `เริ่มครั้งที่ ${nextSession}`}
              </Text>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderPlanCard()}

        {/* Weekly plan strip */}
        <View style={[styles.card, DSShadow]}>
          <WeeklyPlanStrip
            weekPlan={weeklyPlan}
            sessionsPerDay={SESSIONS_PER_DAY}
          />
        </View>

        {/* Calendar progress card */}
        <View style={[styles.card, DSShadow]}>
          <Text style={styles.cardTitle}>ความคืบหน้าการทำกายภาพ</Text>
          <Text style={styles.cardSubtitle}>ปฏิทินแสดงวันที่ทำกายภาพเรียบร้อยแล้ว</Text>
          <CalendarWidget sessionStatusesByDate={sessionStatusesByDate} restDays={new Set<string>()} />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <DeviceConnectionModal
        visible={deviceModalVisible}
        status={deviceStatus}
        onSelectDevice={selectDiscoveredDevice}
        allowDismiss={deviceModalCanDismiss}
        onRequestClose={dismissDeviceModal}
      />
    </SafeAreaView>
  );
}

// ─── Calendar styles ──────────────────────────────────────────────────────────

const calStyles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: DSColors.primaryLight,
  },
  navCenter: {
    alignItems: 'center',
  },
  monthTitle: {
    ...DSTypography.h3,
    color: DSColors.secondary,
  },
  completedCount: {
    ...DSTypography.caption,
    color: DSColors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 2,
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: DSColors.text.secondary,
    paddingVertical: 4,
  },
  sundayHeader: {
    color: DSColors.danger,
  },
  gridRow: {
    flexDirection: 'row',
    marginVertical: 2,
    gap: 3,
  },
  cell: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
    borderRadius: 8,
    backgroundColor: DSColors.surface,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: DSColors.primary,
    backgroundColor: DSColors.primaryLight,
  },
  cellRest: {},
  restLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: DSColors.text.secondary,
  },
  dayNumWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumWrapToday: {
    backgroundColor: DSColors.primary,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '700',
    color: DSColors.secondary,
  },
  dayNumFuture: {
    opacity: 0.35,
    fontWeight: '400',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dotsRowPlaceholder: {
    height: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotDone: {
    backgroundColor: DSColors.success,
  },
  dotProgress: {
    backgroundColor: DSColors.warning,
  },
  dotFailed: {
    backgroundColor: DSColors.danger,
  },
  dotEmpty: {
    backgroundColor: '#E5E7EB',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotGroup: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  legendText: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: DSLayout.screenPadding,
    paddingTop: 8,
  },

  // ── Loading card ──────────────────────────────────────────────────────────
  loadingCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 40,
    marginBottom: DSLayout.sectionGap,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },

  // ── Empty-state card (Scenario B) ─────────────────────────────────────────
  emptyStateCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.sectionGap,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: DSColors.borderLight,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 28,
  },
  manualBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: '100%',
    minHeight: 64,
  },
  manualBigBtnText: {
    ...DSTypography.bodyBold,
    color: DSColors.text.inverse,
    fontSize: 18,
  },

  // ── Scenario A start-session card ─────────────────────────────────────────
  startSessionCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.sectionGap,
    borderWidth: 2,
    borderColor: DSColors.primaryLight,
  },
  startSessionCardPressed: { opacity: 0.95 },
  startSessionCardDone: {
    borderColor: DSColors.success + '40',
    backgroundColor: DSColors.surface,
    opacity: 0.85,
  },
  startSessionHeader: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  kneeImageWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  kneeImageWrapDone: {
    backgroundColor: DSColors.successLight,
  },
  kneeImage: {
    width: 88,
    height: 88,
  },
  kneeImageDone: {
    opacity: 0.5,
  },
  startSessionTitle: {
    ...DSTypography.h2,
    color: DSColors.text.primary,
    marginTop: 6,
  },
  bodyPartText: {
    ...DSTypography.h3,
    color: DSColors.primary,
    textAlign: 'center',
  },
  startSessionSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  textMuted: {
    color: DSColors.text.secondary,
  },

  // ── Session progress dots (green only, gray for pending, no red) ──────────
  sessionProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  sessionProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionProgressDotDone: {
    backgroundColor: DSColors.success,
  },
  sessionProgressDotNext: {
    backgroundColor: DSColors.border,
    borderWidth: 1,
    borderColor: DSColors.text.secondary,
  },
  sessionProgressDotEmpty: {
    backgroundColor: DSColors.borderLight,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  sessionProgressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: DSColors.text.secondary,
    marginLeft: 4,
  },

  // ── Session pips inside GoalChip icon wrap ────────────────────────────────
  sessionPipsWrap: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionPip: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  sessionPipDone: {
    backgroundColor: DSColors.success,
  },
  sessionPipEmpty: {
    backgroundColor: DSColors.border,
  },

  // ── Goal chips row ────────────────────────────────────────────────────────
  goalRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: DSColors.background,
    borderRadius: DSShape.radiusButton,
    padding: 16,
    marginBottom: 12,
  },
  goalRowDone: {
    opacity: 0.6,
  },
  goalChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  goalChipIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  goalChipIconWrapMuted: {
    backgroundColor: DSColors.background,
  },
  goalChipLabel: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  goalChipValue: {
    ...DSTypography.data,
    color: DSColors.primary,
    textAlign: 'center',
  },
  goalChipValueMuted: {
    color: DSColors.text.secondary,
  },
  goalDivider: {
    width: 1,
    backgroundColor: DSColors.border,
    marginVertical: 4,
  },

  // ── CTA button ────────────────────────────────────────────────────────────
  startSessionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  startSessionCtaActive: {
    backgroundColor: DSColors.primary,
  },
  startSessionCtaText: {
    ...DSTypography.bodyBold,
    color: '#FFFFFF',
    fontSize: 18,
  },
  startSessionCtaDone: {
    backgroundColor: DSColors.success,
  },

  // ── Calendar card ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: 16,
    marginTop: 16,
  },
  cardTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
  },
  cardSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 16,
    marginTop: 4,
  },

  bottomSpacer: { height: 32 },
});

// ─── Weekly plan styles ───────────────────────────────────────────────────────
const weekStyles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: DSColors.text.primary,
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.background,
  },
  dayCellToday: {
    backgroundColor: DSColors.primaryLight,
    borderWidth: 1.5,
    borderColor: DSColors.primary,
  },
  dayCellInactive: {},
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: DSColors.text.secondary,
  },
  dayNameToday: {
    color: DSColors.primary,
  },
  dateCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleToday: {
    backgroundColor: DSColors.primary,
  },
  dateNum: {
    fontSize: 13,
    fontWeight: '700',
    color: DSColors.text.primary,
  },
  dateNumToday: {
    color: '#FFFFFF',
  },
  plannedPips: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipDone: {
    backgroundColor: DSColors.success,
  },
  pipProgress: {
    backgroundColor: DSColors.warning,
  },
  pipFailed: {
    backgroundColor: DSColors.danger,
  },
  pipEmpty: {
    backgroundColor: DSColors.border,
  },
  pipPlanned: {
    backgroundColor: DSColors.primary + '50',
    borderWidth: 1,
    borderColor: DSColors.primary,
  },
  restLabel: {
    fontSize: 9,
    color: DSColors.text.secondary,
    fontWeight: '500',
  },
  todayLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: DSColors.primary,
    marginTop: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    color: DSColors.text.secondary,
  },
});
