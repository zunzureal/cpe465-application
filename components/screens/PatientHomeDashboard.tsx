/**
 * Patient Home Dashboard – Friendly, Accessible & Modern
 * Greeting, large "Start Today's Session" card, monthly therapy calendar.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShape,
  DSTypography,
} from '@/constants/design-system';

const IMG_KNEE = require('@/assets/images/knee-brace.png');
const IMG_CLOCK = require('@/assets/images/clock.png');
const IMG_ANGLE = require('@/assets/images/angle.png');

// ─── Mock data ───────────────────────────────────────────────────────────────
const MOCK = {
  todaySession: {
    targetDegrees: '15° – 65°',
    targetTimeMinutes: 20,
    area: 'เข่าขวา',
  },
  // Dates the patient completed therapy (YYYY-MM-DD format)
  completedDates: [
    '2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07', '2026-04-09', '2026-04-11',
    '2026-04-08', '2026-04-10', '2026-04-12', '2026-04-14',
    '2026-04-15', '2026-04-17', '2026-04-19', '2026-04-21',
    '2026-04-22', '2026-04-24', '2026-04-26', '2026-04-28',
    '2026-05-01',
  ],
};

// ─── Calendar widget ──────────────────────────────────────────────────────────

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];


interface CalendarWidgetProps {
  completedDates: string[];
}

function CalendarWidget({ completedDates }: CalendarWidgetProps) {
  const today = new Date();
  const [display, setDisplay] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = display.getFullYear();
  const month = display.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const dateKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const completedSet = new Set(completedDates);
  const isCompleted = (d: number) => completedSet.has(dateKey(d));
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  const isFuture = (d: number) => new Date(year, month, d) > today;

  // Count completed days this month
  const completedThisMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .filter(d => isCompleted(d)).length;

  // Build rows of exactly 7 — pad trailing cells so last row is full
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

  // Streak bars rendered at ROW level — single View from center-to-center, no cell boundary gap
  const CELL_PCT = 100 / 7;

  const renderDay = (d: number | null, colIdx: number) => {
    if (!d) return <View key={`e-${colIdx}`} style={calStyles.cell} />;

    const done = isCompleted(d);
    const todayFlag = isToday(d);
    const future = isFuture(d);
    const isSunday = colIdx === 0;

    return (
      <View key={d} style={calStyles.cell}>
        <View style={[
          calStyles.dayCircle,
          done && calStyles.dayDone,
          todayFlag && !done && calStyles.dayToday,
          todayFlag && done && calStyles.dayDoneToday,
        ]}>
          {done ? (
            <Text style={[calStyles.dayNum, calStyles.dayNumWhite]}>{d}</Text>
          ) : (
            <Text style={[
              calStyles.dayNum,
              todayFlag && calStyles.dayNumToday,
              future && !todayFlag && calStyles.dayNumFuture,
              isSunday && !todayFlag && calStyles.dayNumSunday,
            ]}>
              {d}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderRow = (row: (number | null)[], rowIdx: number) => {
    // Compute streak bars spanning center-of-cell[col] → center-of-cell[col+1]
    const streakBars = row.slice(0, 6).flatMap((d, col) => {
      const dNext = row[col + 1];
      if (!d || !dNext || !isCompleted(d) || !isCompleted(dNext)) return [];
      const leftPct  = (col + 0.5) * CELL_PCT;
      const rightPct = (6 - col - 0.5) * CELL_PCT;
      return [
        <View
          key={`streak-${rowIdx}-${col}`}
          style={[calStyles.streakBar, {
            left: `${leftPct}%` as unknown as number,
            right: `${rightPct}%` as unknown as number,
          }]}
        />,
      ];
    });

    return (
      <View key={rowIdx} style={calStyles.gridRow}>
        {streakBars}
        {row.map((d, colIdx) => renderDay(d, colIdx))}
      </View>
    );
  };

  return (
    <View>
      {/* Month navigation */}
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
            ทำแล้ว {completedThisMonth} / {daysInMonth} วัน
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
          <Text key={h} style={[calStyles.headerCell, h === 'อา' && calStyles.sundayHeader]}>
            {h}
          </Text>
        ))}
      </View>

      {/* Rows */}
      {rows.map((row, rowIdx) => renderRow(row, rowIdx))}

      {/* Legend */}
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, { backgroundColor: DSColors.success }]} />
          <Text style={calStyles.legendText}>ทำแล้ว</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, {
            borderWidth: 2.5, borderColor: DSColors.primary, backgroundColor: 'transparent'
          }]} />
          <Text style={calStyles.legendText}>วันนี้</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function PatientHomeDashboard() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Start session card */}
        <Pressable
          style={({ pressed }) => [
            styles.startSessionCard,
            DSShadow,
            pressed && styles.startSessionCardPressed,
          ]}
          onPress={() => router.push('/therapy-session')}
        >
          <View style={styles.startSessionHeader}>
            <View style={styles.startSessionIconWrap}>
              <Ionicons name="play-circle" size={40} color={DSColors.primary} />
            </View>
            <Text style={styles.startSessionTitle}>เริ่มเซสชัน (Start Doctor's Plan)</Text>
            <Text style={styles.startSessionSubtitle}>
              กดเพื่อเริ่มกายภาพบำบัดตามโปรแกรมของคุณหมอ
            </Text>
          </View>

          <View style={styles.startSessionParams}>
            <View style={styles.paramBlock}>
              <Image source={IMG_KNEE} style={styles.paramIcon} resizeMode="contain" />
              <Text style={styles.paramLabel}>บริเวณ</Text>
              <Text style={styles.paramValue}>{MOCK.todaySession.area}</Text>
            </View>
            <View style={styles.paramDivider} />
            <View style={styles.paramBlock}>
              <Image source={IMG_ANGLE} style={styles.paramIcon} resizeMode="contain" />
              <Text style={styles.paramLabel}>ช่วงองศา</Text>
              <Text style={styles.paramValue}>{MOCK.todaySession.targetDegrees}</Text>
            </View>
            <View style={styles.paramDivider} />
            <View style={styles.paramBlock}>
              <Image source={IMG_CLOCK} style={styles.paramIcon} resizeMode="contain" />
              <Text style={styles.paramLabel}>ระยะเวลา</Text>
              <Text style={styles.paramValue}>{MOCK.todaySession.targetTimeMinutes} นาที</Text>
            </View>
          </View>

          <View style={styles.startSessionCta}>
            <Text style={styles.startSessionCtaText}>เริ่มเซสชัน</Text>
            <Ionicons name="chevron-forward" size={22} color={DSColors.text.inverse} />
          </View>
        </Pressable>

        {/* Calendar progress card */}
        <View style={[styles.card, DSShadow]}>
          <Text style={styles.cardTitle}>ความคืบหน้าการทำกายภาพ</Text>
          <Text style={styles.cardSubtitle}>ปฏิทินแสดงวันที่ทำกายภาพเรียบร้อยแล้ว</Text>
          <CalendarWidget completedDates={MOCK.completedDates} />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    marginBottom: 0,
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: DSColors.text.secondary,
    paddingVertical: 2,
  },
  sundayHeader: {
    color: DSColors.danger,
  },
  gridRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: 3,
  },
  cell: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    overflow: 'visible',
  },
  // Single streak bar spanning exactly from center of one cell to center of adjacent cell
  streakBar: {
    position: 'absolute',
    top: '38%',
    bottom: '38%',
    backgroundColor: DSColors.success,
    zIndex: 0,
  },
  // Default: no background — pill shape (rounded rectangle)
  dayCircle: {
    width: '80%' as unknown as number,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dayDone: {
    backgroundColor: DSColors.success,
  },
  // Today not done: outlined circle, red border + red number
  dayToday: {
    borderWidth: 2.5,
    borderColor: DSColors.primary,
  },
  // Today done: green fill + red border ring
  dayDoneToday: {
    backgroundColor: DSColors.success,
    borderWidth: 2.5,
    borderColor: DSColors.primary,
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '700',
    color: DSColors.secondary,
  },
  dayNumWhite: {
    color: DSColors.text.inverse,
  },
  dayNumToday: {
    color: DSColors.primary,
    fontWeight: '800',
  },
  dayNumFuture: {
    color: DSColors.text.secondary,
    opacity: 0.3,
    fontWeight: '400',
  },
  dayNumSunday: {
    color: DSColors.danger,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
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
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
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
  startSessionCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.sectionGap,
    borderWidth: 2,
    borderColor: DSColors.primaryLight,
  },
  startSessionCardPressed: { opacity: 0.95 },
  startSessionHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  startSessionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  startSessionTitle: {
    ...DSTypography.h2,
    color: DSColors.text.primary,
  },
  startSessionSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 4,
  },
  startSessionParams: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: DSColors.background,
    borderRadius: DSShape.radiusButton,
    padding: 16,
    marginBottom: 12,
  },
  paramBlock: {
    flex: 1,
    alignItems: 'center',
  },
  paramDivider: {
    width: 1,
    backgroundColor: DSColors.border,
    marginVertical: 4,
  },
  paramIcon: {
    width: 72,
    height: 72,
    marginBottom: 10,
  },
  paramLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 4,
  },
  paramValue: {
    ...DSTypography.data,
    color: DSColors.primary,
  },
  startSessionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  startSessionCtaText: {
    ...DSTypography.bodyBold,
    color: DSColors.text.inverse,
    fontSize: 18,
  },
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
