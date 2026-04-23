/**
 * Patient Home Dashboard – Friendly, Accessible & Modern
 * Greeting, large "Start Today's Session" card (target degrees & time), weekly checkmarks.
 */

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
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
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';

// ─── Mock data ───────────────────────────────────────────────────────────
const MOCK = {
  patientName: 'คุณสมชาย',
  greeting: 'สวัสดีครับ',
  todaySession: {
    targetDegrees: '15° – 65°',
    targetTimeMinutes: 20,
    area: 'เข่าขวา',
  },
  doctorPlan: {
    programId: 'PT-2401',
    durationMinutes: 20,
  },
  weeklyProgress: [
    { day: 'จ', label: 'จันทร์', completed: true },
    { day: 'อ', label: 'อังคาร', completed: true },
    { day: 'พ', label: 'พุธ', completed: true },
    { day: 'พฤ', label: 'พฤหัส', completed: false },
    { day: 'ศ', label: 'ศุกร์', completed: false },
    { day: 'ส', label: 'เสาร์', completed: false },
    { day: 'อา', label: 'อาทิตย์', completed: false },
  ],
  nextEvaluation: {
    date: 'พรุ่งนี้',
    time: '10:00 น.',
    doctor: 'พญ.จิราพร ทองแท้',
    description: 'จะเข้ามาตรวจสอบข้อมูลการทำกายภาพของคุณ เพื่อปรับแผนการรักษา',
  },
};

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
        {/* Friendly greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{MOCK.greeting}</Text>
            <Text style={styles.patientName}>{MOCK.patientName}</Text>
          </View>
          <View style={[styles.avatar, DSShadowSoft]}>
            <Ionicons name="person" size={DSLayout.iconSizeLarge} color={DSColors.primary} />
          </View>
        </View>

        {/* Large "Start Today's Session" card – target degrees & time */}
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
              <Text style={styles.paramLabel}>ช่วงองศาเป้าหมาย</Text>
              <Text style={styles.paramValue}>{MOCK.todaySession.targetDegrees}</Text>
            </View>
            <View style={styles.paramDivider} />
            <View style={styles.paramBlock}>
              <Text style={styles.paramLabel}>ระยะเวลา</Text>
              <Text style={styles.paramValue}>{MOCK.todaySession.targetTimeMinutes} นาที</Text>
            </View>
          </View>
          <View style={styles.areaChip}>
            <Ionicons name="body" size={18} color={DSColors.primary} />
            <Text style={styles.areaChipText}>{MOCK.todaySession.area}</Text>
          </View>
          <View style={styles.startSessionCta}>
            <Text style={styles.startSessionCtaText}>เริ่มเซสชัน</Text>
            <Ionicons name="chevron-forward" size={22} color={DSColors.text.inverse} />
          </View>
        </Pressable>

        {/* Weekly progress – checkmarks for completed days */}
        <View style={[styles.card, DSShadow]}>
          <Text style={styles.cardTitle}>ความคืบหน้าระยะสัปดาห์</Text>
          <Text style={styles.cardSubtitle}>วันไหนทำครบแล้วจะมีเครื่องหมายถูก</Text>
          <View style={styles.weekRow}>
            {MOCK.weeklyProgress.map((d) => (
              <View key={d.label} style={styles.dayColumn}>
                <View
                  style={[
                    styles.dayCircle,
                    d.completed ? styles.dayCircleDone : styles.dayCirclePending,
                  ]}
                >
                  {d.completed ? (
                    <Ionicons name="checkmark" size={22} color={DSColors.text.inverse} />
                  ) : (
                    <Text style={styles.dayLetter}>{d.day}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.dayLabel,
                    d.completed && styles.dayLabelDone,
                  ]}
                  numberOfLines={1}
                >
                  {d.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Next evaluation – asynchronous review (no live call) */}
        <View style={[styles.card, styles.appointmentCard, DSShadow]}>
          <View style={styles.appointmentHeader}>
            <Ionicons name="calendar" size={DSLayout.iconSize} color={DSColors.primary} />
            <Text style={styles.cardTitle}>รอบการประเมินผลถัดไป (Next Evaluation)</Text>
          </View>
          <Text style={styles.appointmentWhen}>
            {MOCK.nextEvaluation.date} • {MOCK.nextEvaluation.time}
          </Text>
          <Text style={styles.appointmentDoctor}>
            {MOCK.nextEvaluation.doctor} {MOCK.nextEvaluation.description}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            onPress={() => router.push('/(tabs)/programs')}
          >
            <Text style={styles.cardTitle}>📊 ดูกราฟพัฒนาการของฉัน</Text>
            <Ionicons name="chevron-forward" size={20} color={DSColors.text.inverse} />
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DSLayout.sectionGap,
  },
  greeting: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },
  patientName: {
    ...DSTypography.h1,
    color: DSColors.text.primary,
    marginTop: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: DSShape.radiusRound,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
  paramLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 4,
  },
  paramValue: {
    ...DSTypography.data,
    color: DSColors.primary,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: DSColors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DSShape.radiusChip,
    marginBottom: 16,
  },
  areaChipText: {
    ...DSTypography.bodyBold,
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
  manualPracticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DSColors.primaryLight,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginTop: 12,
    borderWidth: 2,
    borderColor: DSColors.primary,
  },
  manualPracticeButtonPressed: { opacity: 0.9 },
  manualPracticeButtonText: {
    ...DSTypography.bodyBold,
    color: DSColors.primary,
    fontSize: 17,
  },
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: 8,
    marginTop: 8,
  },
  cardTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
  },
  cardSubtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayCircleDone: {
    backgroundColor: DSColors.success,
  },
  dayCirclePending: {
    backgroundColor: DSColors.borderLight,
  },
  dayLetter: {
    ...DSTypography.captionBold,
    color: DSColors.text.secondary,
  },
  dayLabel: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
  },
  dayLabelDone: {
    color: DSColors.success,
    fontWeight: '600',
  },
  appointmentCard: { marginTop: 4 },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  appointmentWhen: {
    ...DSTypography.dataSmall,
    color: DSColors.primary,
  },
  appointmentDoctor: {
    ...DSTypography.body,
    color: DSColors.text.primary,
    marginTop: 4,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  primaryButtonPressed: { opacity: 0.9 },
  primaryButtonText: {
    ...DSTypography.bodyBold,
    color: DSColors.text.inverse,
  },
  bottomSpacer: { height: 32 },
});
