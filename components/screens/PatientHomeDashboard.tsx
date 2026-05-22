/**
 * Patient Home Dashboard – Prescription fetch + Scenario A/B + Calendar.
 *
 * Scenario A (hasPlan): show goal icons (Angle / Duration / Force) from API.
 * Scenario B (noPlan):  friendly empty-state + "เข้าสู่โหมดฝึกอิสระ" CTA.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import {
  bangkokKeyFromParts,
  bangkokParts,
  daysInBangkokMonth,
  firstDayWeekdayBangkok,
  toBangkokDateKey,
  todayBangkokKey,
} from '@/utils/dateUtils';

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
type SessionStatus = 'SUCCESS' | 'MISSED';

// ─── Calendar widget ──────────────────────────────────────────────────────────

const SESSIONS_PER_DAY = 3;

// ─── Weekly plan ──────────────────────────────────────────────────────────────
interface DayPlan {
  scheduled: boolean;
  sessionsCompleted: number;
  sessionStatuses: SessionStatus[];
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// All date keys in this file are YYYY-MM-DD in Asia/Bangkok timezone.
const toDateKey = toBangkokDateKey;

// Backend may omit the `kind` discriminator on freshly-created sessions, so we
// can't rely on `kind === 'session'` alone — that would silently drop every
// entry and wipe the calendar/weekly pips. Infer the type from the fields that
// are present instead.
function isRealSession(s: any): boolean {
  if (s?.kind === 'session') return true;
  if (s?.kind === 'missed') return false;
  // No kind: treat as a real session when it carries result data and isn't MISSED.
  const status = String(s?.sessionStatus ?? s?.status ?? '').toUpperCase();
  if (status === 'MISSED') return false;
  return s?.actualMaxFlexion != null || s?.durationCompleted != null || s?.id != null;
}

function isMissedEntry(s: any): boolean {
  if (s?.kind === 'missed') return true;
  return String(s?.sessionStatus ?? '').toUpperCase() === 'MISSED' && !isRealSession(s);
}

function buildSessionCountsByDate(sessions: SessionResponse[]): Record<string, number> {
  return sessions.reduce<Record<string, number>>((acc, session) => {
    if (!isRealSession(session)) return acc;
    const key = toDateKey(new Date(session.sessionDate));
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function isSessionSuccess(session: Extract<SessionResponse, { kind: 'session' }>): boolean {
  // Accept both `sessionStatus` and `status` fields from backend, case-insensitive.
  const stored = String(session.sessionStatus ?? session.status ?? '').toUpperCase();
  if (stored === 'SUCCESS') return true;
  // Fallback: treat as success when actual flexion meets/exceeds the plan target.
  const achieved = Number(session.actualMaxFlexion);
  const target = Number(session.plan?.targetFlexion);
  if (Number.isFinite(achieved) && Number.isFinite(target) && target > 0 && achieved >= target) {
    return true;
  }
  return false;
}

function buildSessionStatusesByDate(sessions: SessionResponse[]): Record<string, SessionStatus[]> {
  const acc: Record<string, SessionStatus[]> = {};
  // First pass: real session entries — SUCCESS if criteria met, otherwise MISSED.
  // Recording every session entry (not just successes) ensures the calendar shows
  // a dot for days where the user attempted a session, even if it didn't reach target.
  sessions.forEach((session) => {
    if (isRealSession(session)) {
      const key = toDateKey(new Date(session.sessionDate));
      if (!acc[key]) acc[key] = [];
      acc[key].push(isSessionSuccess(session as any) ? 'SUCCESS' : 'MISSED');
    }
  });
  // Second pass: synthesize MISSED for days that had no session entries at all.
  sessions.forEach((session) => {
    if (isMissedEntry(session)) {
      const key = toDateKey(new Date(session.sessionDate));
      const existing = acc[key];
      if (!existing || existing.length === 0) {
        acc[key] = ['MISSED'];
      }
    }
  });
  return acc;
}

interface PlanSchedule {
  active: boolean;
  /** YYYY-MM-DD (Bangkok) inclusive */
  startDateKey?: string;
  /** YYYY-MM-DD (Bangkok) inclusive */
  endDateKey?: string;
  daysOfWeek?: number[]; // 0=Sun..6=Sat (Bangkok weekday)
  sessionsPerDay: number;
}

function buildWeeklyPlanFromCounts(
  sessionCountsByDate: Record<string, number>,
  sessionStatusesByDate: Record<string, SessionStatus[]>,
  schedule: PlanSchedule,
): Record<string, DayPlan> {
  // Anchor to Bangkok day. Build Monday→Sunday of the current Bangkok week.
  const todayKey = todayBangkokKey();
  const todayBkk = bangkokParts(new Date());
  const dayOfWeek = todayBkk.weekday; // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  // Use UTC arithmetic on a midnight-Bangkok instant to safely walk days.
  const mondayInstant = new Date(`${todayKey}T00:00:00+07:00`);
  mondayInstant.setUTCDate(mondayInstant.getUTCDate() + mondayOffset);

  const { active, startDateKey, endDateKey, daysOfWeek, sessionsPerDay } = schedule;

  return Array.from({ length: 7 }, (_, i) => {
    const dInstant = new Date(mondayInstant.getTime());
    dInstant.setUTCDate(mondayInstant.getUTCDate() + i);
    const key = toBangkokDateKey(dInstant);
    const dParts = bangkokParts(dInstant);
    const completed = sessionCountsByDate[key] ?? 0;

    const withinRange =
      (!startDateKey || key >= startDateKey) &&
      (!endDateKey || key <= endDateKey);
    const matchesDayOfWeek =
      !daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(dParts.weekday);
    const isFutureOrToday = key >= todayKey;
    // "scheduled" reflects the plan only — having a non-SUCCESS session log
    // on a day shouldn't make that day appear as planned.
    const scheduled = active && withinRange && matchesDayOfWeek && isFutureOrToday;

    return [
      key,
      {
        scheduled,
        sessionsCompleted: Math.min(completed, sessionsPerDay),
        sessionStatuses: (sessionStatusesByDate[key] ?? []).slice(0, sessionsPerDay),
      },
    ] as const;
  }).reduce<Record<string, DayPlan>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

interface CalendarWidgetProps {
  sessionStatusesByDate: Record<string, SessionStatus[]>;
  sessionsPerDay: number;
  schedule: PlanSchedule;
}

function CalendarWidget({ sessionStatusesByDate, sessionsPerDay, schedule }: CalendarWidgetProps) {
  // Anchor "today" and grid math to Bangkok timezone.
  const todayBkk = bangkokParts(new Date());
  const todayKey = todayBangkokKey();
  const [display, setDisplay] = useState<{ year: number; month0: number }>({
    year: todayBkk.year,
    month0: todayBkk.month0,
  });

  const year = display.year;
  const month = display.month0;
  const daysInMonth = daysInBangkokMonth(year, month);
  const firstDayOfWeek = firstDayWeekdayBangkok(year, month);

  const dateKey = (d: number) => bangkokKeyFromParts(year, month, d);

  const getStatuses = (d: number) => sessionStatusesByDate[dateKey(d)] ?? [];
  const isToday = (d: number) =>
    todayBkk.year === year && todayBkk.month0 === month && todayBkk.day === d;
  const isFuture = (d: number) => dateKey(d) > todayKey;
  // Mirror WeeklyPlanStrip semantics: a day is "scheduled" when the plan is
  // active, the date is in range, and the weekday matches.
  const isScheduled = (d: number) => {
    if (!schedule.active) return false;
    const key = dateKey(d);
    if (schedule.startDateKey && key < schedule.startDateKey) return false;
    if (schedule.endDateKey && key > schedule.endDateKey) return false;
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
      const weekday = new Date(`${key}T00:00:00+07:00`).getUTCDay();
      if (!schedule.daysOfWeek.includes(weekday)) return false;
    }
    return true;
  };
  // Summary counts for the month header — count only SUCCESS sessions so the
  // figures match the "ทำแล้ว" label (MISSED entries are excluded).
  const daysWithSessions = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .filter(d => getStatuses(d).some(s => s === 'SUCCESS')).length;
  const totalSessions = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .reduce((sum, d) => sum + getStatuses(d).filter(s => s === 'SUCCESS').length, 0);

  const flatCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (flatCells.length % 7 !== 0) flatCells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < flatCells.length; i += 7) {
    rows.push(flatCells.slice(i, i + 7));
  }

  const prevMonth = () => {
    const m = month - 1;
    setDisplay(m < 0 ? { year: year - 1, month0: 11 } : { year, month0: m });
  };
  const nextMonth = () => {
    const m = month + 1;
    setDisplay(m > 11 ? { year: year + 1, month0: 0 } : { year, month0: m });
  };

  const renderDay = (d: number | null, colIdx: number) => {
    if (!d) return <View key={`e-${colIdx}`} style={calStyles.cell} />;

    const statuses = getStatuses(d);
    const todayFlag = isToday(d);
    const future = isFuture(d);
    const scheduled = isScheduled(d);

    const numColor = todayFlag
      ? '#FFFFFF'
      : future
      ? DSColors.text.secondary
      : DSColors.secondary;

    // Match WeeklyPlanStrip: show pips when day has logged sessions OR is a
    // scheduled (planned) day. Lets today render empty pips even before any
    // session entry has been logged.
    const showPips = !future && (statuses.length > 0 || scheduled);

    return (
      <View key={d} style={[calStyles.cell, todayFlag && calStyles.cellToday]}>
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

        {/* Status: dots only when sessions exist or day is scheduled */}
        {showPips ? (
          <View style={calStyles.dotsRow}>
            {Array.from({ length: sessionsPerDay }, (_, i) => (
              <View
                key={i}
                style={[
                  calStyles.dot,
                  statuses[i] === 'SUCCESS' ? calStyles.dotDone : calStyles.dotEmpty,
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={calStyles.dotsRowPlaceholder} />
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
            {[0].map(i => <View key={i} style={[calStyles.dot, calStyles.dotDone]} />)}
          </View>
          <Text style={calStyles.legendText}>ทำแล้ว</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={calStyles.legendDotGroup}>
            {[0].map(i => <View key={i} style={[calStyles.dot, calStyles.dotEmpty]} />)}
          </View>
          <Text style={calStyles.legendText}>ยังไม่ทำ</Text>
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
  // Anchor week math to Bangkok day to stay consistent across timezones.
  const todayKey = todayBangkokKey();
  const todayBkk = bangkokParts(new Date());
  const dayOfWeek = todayBkk.weekday; // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayInstant = new Date(`${todayKey}T00:00:00+07:00`);
  mondayInstant.setUTCDate(mondayInstant.getUTCDate() + mondayOffset);

  const days = Array.from({ length: 7 }, (_, i) => {
    const dInstant = new Date(mondayInstant.getTime());
    dInstant.setUTCDate(mondayInstant.getUTCDate() + i);
    const key = toBangkokDateKey(dInstant);
    const parts = bangkokParts(dInstant);
    const isToday = key === todayKey;
    const isFuture = key > todayKey;
    const plan = weekPlan[key] ?? { scheduled: false, sessionsCompleted: 0, sessionStatuses: [] };
    return {
      day: parts.day,
      key,
      isToday,
      isFuture,
      plan,
      dayName: WEEK_DAY_SHORT[parts.weekday],
    };
  });

  return (
    <View style={weekStyles.container}>
      <View style={weekStyles.headerRow}>
        <Ionicons name="calendar-outline" size={16} color={DSColors.primary} />
        <Text style={weekStyles.title}>แผนสัปดาห์นี้</Text>
      </View>
      <View style={weekStyles.strip}>
        {days.map(({ day, key, isToday, isFuture, plan, dayName }) => {
          return (
            <View
              key={key}
              style={[
                weekStyles.dayCell,
                isToday && weekStyles.dayCellToday,
              ]}
            >
              {/* Day name */}
              <Text style={[weekStyles.dayName, isToday && weekStyles.dayNameToday]}>
                {dayName}
              </Text>

              {/* Date number */}
              <View style={[weekStyles.dateCircle, isToday && weekStyles.dateCircleToday]}>
                <Text style={[
                  weekStyles.dateNum,
                  isToday && weekStyles.dateNumToday,
                  !isToday && isFuture && weekStyles.dateNumFuture,
                ]}>
                  {day}
                </Text>
              </View>

              {/* Status indicator — hide entirely when no plan & no sessions */}
              {isFuture && plan.scheduled ? (
                <View style={weekStyles.plannedPips}>
                  {Array.from({ length: sessionsPerDay }, (_, i) => (
                    <View key={i} style={[weekStyles.pip, weekStyles.pipPlanned]} />
                  ))}
                </View>
              ) : !isFuture && (plan.scheduled || plan.sessionStatuses.length > 0) ? (
                <View style={weekStyles.plannedPips}>
                  {Array.from({ length: sessionsPerDay }, (_, i) => {
                    const status = plan.sessionStatuses[i];
                    return (
                      <View
                        key={i}
                        style={[
                          weekStyles.pip,
                          status === 'SUCCESS' ? weekStyles.pipDone : weekStyles.pipEmpty,
                        ]}
                      />
                    );
                  })}
                </View>
              ) : null}

              {/* Status label */}
              {isToday && (
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
  const [planSchedule, setPlanSchedule] = useState<PlanSchedule>({
    active: false,
    sessionsPerDay: SESSIONS_PER_DAY,
  });
  const { patientId, patientName, identifier } = useAuth();

  // Refetch on focus so returning from /therapy-session refreshes today's pips
  // and counts. Tab stacks keep the component mounted, so a plain useEffect
  // with [patientId] wouldn't re-run after a session is submitted.
  useFocusEffect(useCallback(() => {
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

        // History (counts/statuses) is independent of the current preset — keep
        // showing past sessions even when there's no active prescription.
        const counts = sessionsResponse.success && sessionsResponse.data
          ? buildSessionCountsByDate(sessionsResponse.data)
          : {};
        const statuses = sessionsResponse.success && sessionsResponse.data
          ? buildSessionStatusesByDate(sessionsResponse.data)
          : {};
        setSessionCountsByDate(counts);
        setSessionStatusesByDate(statuses);

        // Fallback sessionsPerDay derived from the most recent session entry's plan —
        // used when the active preset is missing (e.g. last plan COMPLETED).
        const stats = statsResponse.success ? (statsResponse.data as TodayStatsResponse) : null;
        const sessionsPerDayFromHistory = sessionsResponse.success && sessionsResponse.data
          ? sessionsResponse.data.find((s) => s.plan?.sessionsPerDay)?.plan?.sessionsPerDay
          : undefined;
        const fallbackSessionsPerDay =
          sessionsPerDayFromHistory ?? stats?.totalSessionsTarget ?? SESSIONS_PER_DAY;

        if (!presetResponse.success) {
          setPlanState('noPlan');
          setTodayPlan(null);
          setPlanSchedule({ active: false, sessionsPerDay: fallbackSessionsPerDay });
          setWeeklyPlan(
            buildWeeklyPlanFromCounts(counts, statuses, {
              active: false,
              sessionsPerDay: fallbackSessionsPerDay,
            }),
          );
          return;
        }

        const preset = presetResponse.data;

        const presetStatus = String(preset?.status ?? '').toUpperCase();
        // Plan date range is compared as Bangkok-day strings (YYYY-MM-DD) to avoid
        // timezone ambiguity when the backend returns ISO instants like "...T00:00:00.000Z".
        const toKey = (s?: string): string | undefined => {
          if (!s) return undefined;
          const key = toBangkokDateKey(s);
          return key || undefined;
        };
        const isActive = ['ACTIVE', 'IN_PROGRESS'].includes(presetStatus);
        const startDateKey = toKey(preset?.startDate);
        const endDateKey = toKey(preset?.endDate);
        const daysOfWeek = preset?.daysOfWeek;

        // Check whether today (Bangkok) is actually a scheduled day for this preset.
        const todayKeyForSchedule = todayBangkokKey();
        const todayWeekdayBkk = bangkokParts(new Date()).weekday;
        const withinRangeToday =
          (!startDateKey || todayKeyForSchedule >= startDateKey) &&
          (!endDateKey || todayKeyForSchedule <= endDateKey);
        const matchesDayOfWeekToday =
          !daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(todayWeekdayBkk);
        const todayIsScheduled = isActive && withinRangeToday && matchesDayOfWeekToday;

        const sessionsPerDay =
          preset?.sessionsPerDay ?? stats?.totalSessionsTarget ?? SESSIONS_PER_DAY;

        const schedule: PlanSchedule = {
          active: isActive,
          startDateKey,
          endDateKey,
          daysOfWeek,
          sessionsPerDay,
        };
        setPlanSchedule(schedule);
        setWeeklyPlan(buildWeeklyPlanFromCounts(counts, statuses, schedule));

        if (!todayIsScheduled) {
          // Plan exists but today isn't in the schedule — treat like noPlan for the hero card.
          setTodayPlan(null);
          setPlanState('noPlan');
          return;
        }

        // Count today's completed sessions from the sessions list filtered by
        // Bangkok day — frontend-authoritative to avoid backend timezone drift.
        // `todayStats` is used only as a fallback when the list is missing.
        const todayKey = todayBangkokKey();
        const todaySessionsFromList = sessionsResponse.success && sessionsResponse.data
          ? sessionsResponse.data.filter(
              (s) => isRealSession(s) && toBangkokDateKey(s.sessionDate) === todayKey,
            ).length
          : 0;
        const todaySessionsPerDay =
          preset?.sessionsPerDay ?? stats?.totalSessionsTarget ?? SESSIONS_PER_DAY;
        const todaySessionsCompleted = sessionsResponse.success
          ? todaySessionsFromList
          : (stats?.sessionsCompleted ?? 0);

        setTodayPlan({
          targetFlexion: Number(preset?.targetFlexion ?? 90),
          durationMinutes: Number(preset?.durationMinutes ?? 15),
          targetForceN: typeof preset?.targetForceN === 'number' ? preset.targetForceN : 10,
          sessionsPerDay: todaySessionsPerDay,
          sessionsCompletedToday: todaySessionsCompleted,
        });
        setPlanState('hasPlan');
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[PatientHomeDashboard] Fetch error:', err);
          // Don't wipe history on a transient fetch failure — keep the last
          // good counts/statuses/weeklyPlan so the pips don't vanish.
          setPlanState((prev) => (prev === 'loading' ? 'noPlan' : prev));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]));

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
            style={[styles.startSessionCta, styles.startSessionCtaActive, styles.emptyStateCta]}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={() => startMockConnection(() => router.push('/manual-setup'))}
            accessibilityRole="button"
            accessibilityLabel="เข้าสู่โหมดฝึกอิสระ"
          >
            <Text style={styles.startSessionCtaText}>เข้าสู่โหมดฝึกอิสระ</Text>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      );
    }

    // Scenario A — has plan
    const plan = todayPlan!;
    const nextSession = plan.sessionsCompletedToday + 1;
    const allDone = plan.sessionsCompletedToday >= plan.sessionsPerDay;
    console.log('[PatientHomeDashboard] render plan card', {
      sessionsCompletedToday: plan.sessionsCompletedToday,
      sessionsPerDay: plan.sessionsPerDay,
      allDone,
    });

    return (
      <View
        style={[
          styles.startSessionCard,
          DSShadow,
          allDone && styles.startSessionCardDone,
        ]}
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

        {/* CTA Button — only button is pressable */}
        <Pressable
          disabled={allDone}
          style={[
            styles.startSessionCta,
            allDone ? styles.startSessionCtaDone : styles.startSessionCtaActive,
          ]}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          onPress={() => startMockConnection(() => router.push('/therapy-session'))}
          accessibilityRole="button"
          accessibilityLabel={allDone ? 'ทำครบทุกเซสชันแล้ว' : 'เริ่มเซสชันกายภาพบำบัด'}
        >
          {allDone ? (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.startSessionCtaText}>ทำครบทุกเซสชันแล้ว</Text>
            </>
          ) : (
            <>
              <Text style={styles.startSessionCtaText}>
                เริ่มครั้งที่ {nextSession}
              </Text>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
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
            sessionsPerDay={planSchedule.sessionsPerDay}
          />
        </View>

        {/* Calendar progress card */}
        <View style={[styles.card, DSShadow]}>
          <Text style={styles.cardTitle}>ความคืบหน้าการทำกายภาพ</Text>
          <Text style={styles.cardSubtitle}>ปฏิทินแสดงวันที่ทำกายภาพเรียบร้อยแล้ว</Text>
          <CalendarWidget
            sessionStatusesByDate={sessionStatusesByDate}
            sessionsPerDay={planSchedule.sessionsPerDay}
            schedule={planSchedule}
          />
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
  textMuted: {
    color: DSColors.text.secondary,
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
    backgroundColor: DSColors.success,
    gap: 4,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  startSessionCtaActive: {
    backgroundColor: DSColors.primary,
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  startSessionCtaText: {
    ...DSTypography.bodyBold,
    color: '#ffffff',
    fontSize: 16,
  },
  startSessionCtaDone: {
    backgroundColor: DSColors.success,
  },
  emptyStateCta: {
    width: '100%',
    height: 54,
    marginTop: 4,
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
  dateNumFuture: {
    color: DSColors.text.secondary,
    opacity: 0.35,
    fontWeight: '400',
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
  pipEmpty: {
    backgroundColor: DSColors.border,
  },
  pipPlanned: {
    backgroundColor: DSColors.primary + '50',
    borderWidth: 1,
    borderColor: DSColors.primary,
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
