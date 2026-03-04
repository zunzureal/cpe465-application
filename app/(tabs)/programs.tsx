/**
 * History (ประวัติ) – Patient-friendly session history with cards.
 * No admin tables; health-app style cards with badges and summary.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TEAL = '#0B8FAC';
const GREEN = '#22A861';
const GREEN_BADGE_BG = '#E8F7EF';
const ORANGE = '#E67E22';
const ORANGE_BADGE_BG = '#FEF3E2';

// Mock past sessions: date/time, achieved flexion, pain 1=😃 2=😐 3=😫, isManual
const MOCK_SESSIONS = [
  { id: '1', dateTime: '4 มี.ค. 2568, 09:30', achievedFlexion: 90, painLevel: 1 as 1 | 2 | 3, isManual: false },
  { id: '2', dateTime: '3 มี.ค. 2568, 14:00', achievedFlexion: 85, painLevel: 2 as 1 | 2 | 3, isManual: true },
  { id: '3', dateTime: '2 มี.ค. 2568, 10:15', achievedFlexion: 88, painLevel: 1 as 1 | 2 | 3, isManual: false },
  { id: '4', dateTime: '1 มี.ค. 2568, 16:45', achievedFlexion: 82, painLevel: 2 as 1 | 2 | 3, isManual: false },
  { id: '5', dateTime: '28 ก.พ. 2568, 11:00', achievedFlexion: 80, painLevel: 1 as 1 | 2 | 3, isManual: true },
];

const PAIN_EMOJI: Record<1 | 2 | 3, string> = { 1: '😃', 2: '😐', 3: '😫' };

function sessionsThisWeek() {
  // Mock: consider last 7 days; in real app filter by date
  return MOCK_SESSIONS.length;
}

export default function HistoryScreen() {
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0D1117' : '#F0F6FA';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1A2B3C';
  const textSecondary = isDark ? '#8FA0B0' : '#6B8099';
  const borderColor = isDark ? '#2D3945' : '#E5E7EB';
  const summaryBg = isDark ? '#0D2630' : '#E8F6FA';

  const count = sessionsThisWeek();

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
            <View style={styles.flexionRow}>
              <Text style={[styles.flexionLabel, { color: textSecondary }]}>
                งอเข่าได้
              </Text>
              <Text style={[styles.flexionValue, { color: textPrimary }]}>
                {session.achievedFlexion}°
              </Text>
            </View>
            <Text style={[styles.achievedFlexionBig, { color: textPrimary }]}>
              งอเข่าได้ {session.achievedFlexion}°
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
  flexionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  flexionLabel: {
    fontSize: 15,
  },
  flexionValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  achievedFlexionBig: {
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
