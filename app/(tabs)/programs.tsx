/**
 * History (ประวัติ) – Patient-friendly: Progress graph + session cards.
 * Uses react-native-chart-kit for flexion progress (target vs actual).
 */

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TEAL = '#0B8FAC';
const GREEN = '#22A861';
const GREEN_BADGE_BG = '#E8F7EF';
const ORANGE = '#E67E22';
const ORANGE_BADGE_BG = '#FEF3E2';
const TARGET_LINE_COLOR = '#7DD3FC'; // light blue
const ACTUAL_LINE_COLOR = '#22A861'; // green

// Mock: date/time, achieved flexion, target (from doctor), pain 1=😃 2=😐 3=😫, isManual — 7 days
const MOCK_SESSIONS = [
  { id: '1', dateTime: '4 มี.ค. 2568, 09:30', achievedFlexion: 90, targetFlexion: 85, painLevel: 1 as 1 | 2 | 3, isManual: false, dayLabel: 'ศ.' },
  { id: '2', dateTime: '3 มี.ค. 2568, 14:00', achievedFlexion: 85, targetFlexion: 85, painLevel: 2 as 1 | 2 | 3, isManual: true, dayLabel: 'พฤ.' },
  { id: '3', dateTime: '2 มี.ค. 2568, 10:15', achievedFlexion: 88, targetFlexion: 85, painLevel: 1 as 1 | 2 | 3, isManual: false, dayLabel: 'พ.' },
  { id: '4', dateTime: '1 มี.ค. 2568, 16:45', achievedFlexion: 82, targetFlexion: 80, painLevel: 2 as 1 | 2 | 3, isManual: false, dayLabel: 'อ.' },
  { id: '5', dateTime: '28 ก.พ. 2568, 11:00', achievedFlexion: 80, targetFlexion: 75, painLevel: 1 as 1 | 2 | 3, isManual: true, dayLabel: 'จ.' },
  { id: '6', dateTime: '27 ก.พ. 2568, 09:00', achievedFlexion: 78, targetFlexion: 75, painLevel: 2 as 1 | 2 | 3, isManual: false, dayLabel: 'อา.' },
  { id: '7', dateTime: '26 ก.พ. 2568, 15:30', achievedFlexion: 75, targetFlexion: 70, painLevel: 1 as 1 | 2 | 3, isManual: true, dayLabel: 'ส.' },
];

const PAIN_EMOJI: Record<1 | 2 | 3, string> = { 1: '😃', 2: '😐', 3: '😫' };

function sessionsThisWeek() {
  return MOCK_SESSIONS.length;
}

// Chart config: readable labels, Y 0–150°
const chartConfig = (labelColor: string, gridColor: string) => ({
  backgroundColor:  '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0,0,0,${opacity * 0.3})`,
  labelColor: () => labelColor,
  style: { borderRadius: 16, paddingRight: 0 },
  propsForLabels: { fontSize: 14, fontWeight: '600' as const },
  propsForBackgroundLines: { stroke: gridColor, strokeWidth: 0.5 },
  fillShadowGradient: '#22A861',
  fillShadowGradientOpacity: 0.15,
});

export default function HistoryScreen() {
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0D1117' : '#F0F6FA';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1A2B3C';
  const textSecondary = isDark ? '#8FA0B0' : '#6B8099';
  const borderColor = isDark ? '#2D3945' : '#E5E7EB';
  const summaryBg = isDark ? '#0D2630' : '#E8F6FA';
  const gridColor = isDark ? '#2D3945' : '#E5E7EB';

  const count = sessionsThisWeek();

  // Chart data: chronological (oldest first). Last 5–7 sessions.
  const chartData = useMemo(() => {
    const reversed = [...MOCK_SESSIONS].reverse();
    return {
      labels: reversed.map((s) => s.dayLabel),
      datasets: [
        {
          data: reversed.map((s) => s.targetFlexion),
          color: (): string => TARGET_LINE_COLOR,
          strokeWidth: 2,
          strokeDashArray: [6, 4],
        },
        {
          data: reversed.map((s) => s.achievedFlexion),
          color: (): string => ACTUAL_LINE_COLOR,
          strokeWidth: 3,
        },
      ],
    };
  }, []);

  const { width: screenWidth } = useWindowDimensions();
  const contentPadding = 24 * 2;
  const cardPadding = 20 * 2;
  const chartWidth = Math.max(screenWidth - contentPadding - cardPadding, 200);
  const chartHeight = Math.max(180, Math.min(220, screenWidth * 0.6));

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#0C2535' : TEAL }]}>
        <Text style={styles.headerTitle}>ประวัติ</Text>
        <Text style={styles.headerSubtitle}>History</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Progress Graph ───────────────────────────────────────────── */}
        <View style={[styles.chartCard, { backgroundColor: '#FFFFFF', borderColor }]}>
          <Text style={[styles.chartTitle, { color: textPrimary }]}>
            กราฟพัฒนาการองศาการงอเข่า (Flexion Progress)
          </Text>
          <LineChart
            data={chartData}
            width={chartWidth}
            height={chartHeight}
            yAxisLabel=""
            yAxisSuffix="°"
            {...({ yAxisMin: 0, yAxisMax: 150, fromZero: true } as Record<string, unknown>)}
            bezier
            withInnerLines
            withOuterLines
            chartConfig={chartConfig(textSecondary, gridColor)}
            style={styles.chart}
            withDots
            withVerticalLabels
            withHorizontalLabels
            segments={5}
            formatYLabel={(v) => `${v}°`}
          />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: TARGET_LINE_COLOR }]} />
              <Text style={[styles.legendText, { color: textPrimary }]}>เป้าหมายจากแพทย์</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: ACTUAL_LINE_COLOR }]} />
              <Text style={[styles.legendText, { color: textPrimary }]}>ที่คุณทำได้จริง</Text>
            </View>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: summaryBg, borderColor }]}>
          <Text style={[styles.summaryText, { color: textPrimary }]}>
            เยี่ยมมาก! คุณทำกายภาพไปแล้ว {count} ครั้งในสัปดาห์นี้
          </Text>
          <Text style={[styles.summarySub, { color: textSecondary }]}>
            Great job! You've completed {count} sessions this week.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: textSecondary }]}>เซสชันที่ผ่านมา</Text>

        {MOCK_SESSIONS.map((session) => (
          <View
            key={session.id}
            style={[styles.card, { backgroundColor: cardBg, borderColor }]}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.cardDateTime, { color: textSecondary }]}>
                {session.dateTime}
              </Text>
              <View
                style={[
                  styles.badge,
                  session.isManual
                    ? { backgroundColor: ORANGE_BADGE_BG }
                    : { backgroundColor: GREEN_BADGE_BG },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: session.isManual ? ORANGE : GREEN },
                  ]}
                >
                  {session.isManual ? 'ฝึกอิสระ' : 'ตามแผนแพทย์'}
                </Text>
              </View>
            </View>
            <Text style={[styles.achievedVsTarget, { color: textPrimary }]}>
              ทำได้ {session.achievedFlexion}° / เป้าหมาย {session.targetFlexion}°
            </Text>
            <View style={styles.painRow}>
              <Text style={[styles.painLabel, { color: textSecondary }]}>
                ระดับความเจ็บปวด
              </Text>
              <Text style={styles.painEmoji}>{PAIN_EMOJI[session.painLevel]}</Text>
            </View>
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  chartCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
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
  legendText: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  summarySub: {
    fontSize: 14,
    marginTop: 6,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDateTime: {
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  achievedVsTarget: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  painLabel: {
    fontSize: 14,
  },
  painEmoji: {
    fontSize: 28,
  },
  bottomSpacer: { height: 24 },
});
