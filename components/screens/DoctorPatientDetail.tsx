/**
 * Doctor Patient Detail — tabbed screen with Overview, Prescription, and History tabs.
 * Launched by tapping a patient row in DoctorOverviewDashboard.
 */

import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  DSColors,
  DSLayout,
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDoctorPatientsWithStatus,
  getPatientTodayStats,
  getPatientPreset,
  type PatientWithStatus,
  type TodayStatsResponse,
  type TreatmentPlanResponse,
} from '@/services/apiClient';
import { PatientStatusBadge } from '@/components/ui/PatientStatusBadge';

type Tab = 'overview' | 'prescription' | 'history';

interface Props {
  patientId: number;
}

export function DoctorPatientDetail({ patientId }: Props) {
  const router = useRouter();
  const { authToken } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [patient, setPatient] = useState<PatientWithStatus | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStatsResponse | null>(null);
  const [preset, setPreset] = useState<TreatmentPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken) {
      setError('ไม่มีสิทธิ์เข้าถึง');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getDoctorPatientsWithStatus(authToken),
      getPatientTodayStats(patientId),
      getPatientPreset(patientId),
    ])
      .then(([patientsRes, statsRes, presetRes]) => {
        if (cancelled) return;

        const found = patientsRes.data?.patients.find((p) => p.id === patientId) ?? null;
        setPatient(found);
        if (statsRes.success) setTodayStats(statsRes.data ?? null);
        if (presetRes.success) setPreset(presetRes.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, patientId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DSColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !patient) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={52} color={DSColors.danger} />
          <Text style={styles.errorText}>{error ?? 'ไม่พบข้อมูลผู้ป่วย'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'overview', label: 'ภาพรวม', icon: 'bar-chart-outline' },
    { key: 'prescription', label: 'ใบสั่งยา', icon: 'document-text-outline' },
    { key: 'history', label: 'ประวัติ', icon: 'time-outline' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Back + header */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={DSColors.primary} />
          <Text style={styles.backLabel}>ย้อนกลับ</Text>
        </Pressable>
      </View>

      {/* Patient header card */}
      <View style={[styles.patientCard, DSShadowSoft]}>
        <View style={styles.patientAvatar}>
          <Ionicons name="person" size={32} color={DSColors.primary} />
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientMeta}>{patient.hnCode} · อายุ {patient.age} ปี</Text>
        </View>
        <PatientStatusBadge status={patient.todayStatus} />
      </View>

      {/* Internal tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={isActive ? DSColors.primary : DSColors.text.secondary}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {activeTab === 'overview' && (
          <OverviewTab todayStats={todayStats} preset={preset} patient={patient} />
        )}
        {activeTab === 'prescription' && (
          <NavigateTab
            icon="document-text"
            title="ตั้งค่าใบสั่งยา / Prescription"
            description="กำหนดพารามิเตอร์ CPM สำหรับผู้ป่วยรายนี้"
            actionLabel="เปิดฟอร์มใบสั่งยา"
            onPress={() =>
              router.push({
                pathname: '/patient/[patientId]/prescription',
                params: { patientId },
              })
            }
          />
        )}
        {activeTab === 'history' && (
          <NavigateTab
            icon="time"
            title="ประวัติการรักษา / History"
            description="ดูผลการทำกายภาพทุกครั้งที่ผ่านมา"
            actionLabel="ดูประวัติทั้งหมด"
            onPress={() =>
              router.push({
                pathname: '/patient/[patientId]/history',
                params: { patientId },
              })
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────

function OverviewTab({
  todayStats,
  preset,
  patient,
}: {
  todayStats: TodayStatsResponse | null;
  preset: TreatmentPlanResponse | null;
  patient: PatientWithStatus;
}) {
  const lastSessionLabel = patient.lastSessionDate
    ? new Date(patient.lastSessionDate).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'ยังไม่มีประวัติ';

  return (
    <View style={styles.tabContent}>
      {/* Today stats */}
      <Text style={styles.sectionTitle}>สรุปวันนี้ · Today's Summary</Text>
      {todayStats ? (
        <View style={[styles.statsGrid, DSShadowSoft]}>
          <StatItem label="เซสชันที่ทำ" value={`${todayStats.sessionsCompleted} / ${todayStats.totalSessionsTarget}`} unit="ครั้ง" />
          <View style={styles.statDivider} />
          <StatItem label="Flexion สูงสุด" value={`${todayStats.maxFlexion}°`} unit={`เป้า ${todayStats.targetFlexion}°`} />
          <View style={styles.statDivider} />
          <StatItem label="เวลารวม" value={`${todayStats.totalMinutes}`} unit="นาที" />
        </View>
      ) : (
        <View style={[styles.emptyCard, DSShadowSoft]}>
          <Text style={styles.emptyText}>ยังไม่มีเซสชันวันนี้</Text>
        </View>
      )}

      {/* Active preset */}
      <Text style={[styles.sectionTitle, { marginTop: DSLayout.sectionGap }]}>
        แผนการรักษาปัจจุบัน · Active Plan
      </Text>
      {preset ? (
        <View style={[styles.presetCard, DSShadowSoft]}>
          <PresetRow label="Flexion เป้าหมาย" value={`${preset.targetFlexion}°`} />
          <PresetRow label="Extension เป้าหมาย" value={`${preset.targetExtension}°`} />
          <PresetRow label="ระดับความเร็ว" value={`${preset.speedLevel} / 5`} />
          <PresetRow label="ระยะเวลา" value={`${preset.durationMinutes} นาที`} />
          <PresetRow label="Warm-up" value={preset.useWarmup ? 'เปิด' : 'ปิด'} />
          {preset.targetForceN != null && (
            <PresetRow label="แรงเป้าหมาย" value={`${preset.targetForceN} N`} />
          )}
        </View>
      ) : (
        <View style={[styles.emptyCard, DSShadowSoft]}>
          <Text style={styles.emptyText}>ยังไม่มีแผนการรักษา</Text>
          <Text style={styles.emptyHint}>ไปที่แท็บ "ใบสั่งยา" เพื่อสร้างแผนใหม่</Text>
        </View>
      )}

      {/* Last session */}
      <View style={[styles.lastSessionRow, DSShadowSoft]}>
        <Ionicons name="time-outline" size={18} color={DSColors.text.secondary} />
        <Text style={styles.lastSessionLabel}>เซสชันล่าสุด: </Text>
        <Text style={styles.lastSessionValue}>{lastSessionLabel}</Text>
      </View>
    </View>
  );
}

function StatItem({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function PresetRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.presetRow}>
      <Text style={styles.presetLabel}>{label}</Text>
      <Text style={styles.presetValue}>{value}</Text>
    </View>
  );
}

// ─── Navigate-to-route tab placeholder ────────────────────────────────────

function NavigateTab({
  icon,
  title,
  description,
  actionLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      <View style={[styles.navigateCard, DSShadowSoft]}>
        <Ionicons name={icon} size={40} color={DSColors.primary} />
        <Text style={styles.navigateTitle}>{title}</Text>
        <Text style={styles.navigateDesc}>{description}</Text>
        <Pressable style={styles.navigateBtn} onPress={onPress}>
          <Text style={styles.navigateBtnLabel}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    ...DSTypography.body,
    color: DSColors.danger,
    textAlign: 'center',
    marginHorizontal: 32,
  },

  // Nav bar
  navBar: {
    paddingHorizontal: DSLayout.screenPadding,
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...DSTypography.body,
    color: DSColors.primary,
  },

  // Patient card
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DSColors.surface,
    marginHorizontal: DSLayout.screenPadding,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    gap: 12,
    marginBottom: 16,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
  },
  patientMeta: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 4,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: DSLayout.screenPadding,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusButton,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: DSShape.radiusButton - 2,
  },
  tabBtnActive: {
    backgroundColor: DSColors.primaryLight,
  },
  tabLabel: {
    ...DSTypography.captionBold,
    color: DSColors.text.secondary,
  },
  tabLabelActive: {
    color: DSColors.primary,
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 32,
  },
  tabContent: {
    paddingHorizontal: DSLayout.screenPadding,
  },
  sectionTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 12,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...DSTypography.data,
    color: DSColors.text.primary,
  },
  statLabel: {
    ...DSTypography.captionBold,
    color: DSColors.text.primary,
    marginTop: 4,
    textAlign: 'center',
  },
  statUnit: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: DSColors.border,
    marginHorizontal: 8,
  },

  // Preset card
  presetCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    overflow: 'hidden',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DSLayout.cardPadding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  presetLabel: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },
  presetValue: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },

  // Empty states
  emptyCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },
  emptyHint: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },

  // Last session row
  lastSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 14,
    marginTop: 12,
    gap: 6,
  },
  lastSessionLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  lastSessionValue: {
    ...DSTypography.captionBold,
    color: DSColors.text.primary,
    flex: 1,
  },

  // Navigate tab
  navigateCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  navigateTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    textAlign: 'center',
  },
  navigateDesc: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DSColors.primary,
    borderRadius: DSShape.radiusButton,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  navigateBtnLabel: {
    ...DSTypography.bodyBold,
    color: '#fff',
  },
});
