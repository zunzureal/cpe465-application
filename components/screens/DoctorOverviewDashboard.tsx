/**
 * Doctor Overview Dashboard – Clean, modern, tablet-friendly.
 * Summary cards (Total Patients, Completed Today, Alerts) + patient list with search.
 * Fetches real patient data from database.
 */

import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { getDoctorPatientsWithStatus, type PatientWithStatus } from '@/services/apiClient';
import { PatientStatusBadge } from '@/components/ui/PatientStatusBadge';

export function DoctorOverviewDashboard() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const { authToken } = useAuth();
  const router = useRouter();
  const isTablet = width >= 768;

  useEffect(() => {
    if (!authToken) {
      setError('ไม่มีสิทธิ์เข้าถึง');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getDoctorPatientsWithStatus(authToken)
      .then((response) => {
        if (cancelled) return;

        if (!response.success || !response.data?.patients) {
          setError(response.error || 'ไม่สามารถโหลดรายชื่อผู้ป่วย');
          setPatients([]);
          return;
        }

        setPatients(response.data.patients);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[DoctorOverviewDashboard] Fetch error:', err);
          setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
          setPatients([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.hnCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalPatients = patients.length;
  const completedToday = patients.filter((p) => p.todayStatus === 'normal').length;
  const alerts = patients.filter((p) => p.todayStatus === 'alert_pain').length;

  const summaryCards = [
    {
      key: 'total',
      label: 'ผู้ป่วยทั้งหมด',
      value: totalPatients,
      icon: 'people' as const,
      color: DSColors.primary,
      bg: DSColors.primaryLight,
    },
    {
      key: 'completed',
      label: 'ทำครบวันนี้',
      value: completedToday,
      icon: 'checkmark-circle' as const,
      color: DSColors.success,
      bg: DSColors.successLight,
    },
    {
      key: 'alerts',
      label: 'แจ้งเตือน',
      value: alerts,
      icon: 'warning' as const,
      color: DSColors.danger,
      bg: DSColors.dangerLight,
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={DSColors.primary} />
          <Text style={styles.loadingText}>กำลังโหลดรายชื่อผู้ป่วย...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={52} color={DSColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.container, isTablet && styles.containerTablet]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ภาพรวมแพทย์</Text>
          <Text style={styles.subtitle}>Doctor Overview</Text>
        </View>

        {/* Summary cards */}
        <View style={[styles.summaryRow, isTablet && styles.summaryRowTablet]}>
          {summaryCards.map((card) => (
            <View key={card.key} style={[styles.summaryCard, DSShadowSoft]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: card.bg }]}>
                <Ionicons name={card.icon} size={28} color={card.color} />
              </View>
              <Text style={styles.summaryValue}>{card.value}</Text>
              <Text style={styles.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Patient list section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>รายชื่อผู้ป่วย</Text>
          <View style={[styles.searchWrap, DSShadowSoft]}>
            <Ionicons name="search" size={20} color={DSColors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาชื่อหรือรหัสประจำตัว..."
              placeholderTextColor={DSColors.text.secondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={DSColors.text.secondary} />
              </Pressable>
            )}
          </View>

          <View style={[styles.listCard, DSShadow]}>
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>ไม่พบผู้ป่วยที่ตรงกับคำค้น</Text>
                </View>
              }
              renderItem={({ item }) => (
                <PatientRow
                  item={item}
                  onPress={() =>
                    router.push({
                      pathname: '/patient/[patientId]',
                      params: { patientId: item.id },
                    })
                  }
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={filtered.length === 0 ? styles.listContentEmpty : undefined}
              scrollEnabled={!isTablet}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PatientRow({ item, onPress }: { item: PatientWithStatus; onPress: () => void }) {
  const lastSessionLabel = item.lastSessionDate
    ? new Date(item.lastSessionDate).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      })
    : 'ยังไม่มีประวัติ';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowAvatar}>
        <Ionicons name="person" size={22} color={DSColors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowHn}>{item.hnCode} · อายุ {item.age} ปี</Text>
        <Text style={styles.rowLast}>ครั้งล่าสุด: {lastSessionLabel}</Text>
      </View>
      <View style={styles.rowRight}>
        <PatientStatusBadge status={item.todayStatus} />
        <Ionicons name="chevron-forward" size={16} color={DSColors.text.secondary} style={styles.chevron} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },
  errorText: {
    ...DSTypography.body,
    color: DSColors.danger,
    textAlign: 'center',
    marginHorizontal: 32,
  },
  container: {
    flex: 1,
    padding: DSLayout.screenPadding,
  },
  containerTablet: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: DSLayout.sectionGap,
  },
  title: {
    ...DSTypography.h1,
    color: DSColors.text.primary,
  },
  subtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: DSLayout.itemGap,
    marginBottom: DSLayout.sectionGap,
  },
  summaryRowTablet: {
    gap: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    alignItems: 'center',
    minWidth: 0,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    ...DSTypography.data,
    color: DSColors.text.primary,
  },
  summaryLabel: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    flex: 1,
    minHeight: 280,
  },
  sectionTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusButton,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: DSColors.borderLight,
  },
  searchInput: {
    flex: 1,
    ...DSTypography.body,
    color: DSColors.text.primary,
    paddingVertical: 0,
  },
  listCard: {
    flex: 1,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    overflow: 'hidden',
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: DSLayout.cardPadding,
  },
  rowPressed: {
    backgroundColor: DSColors.background,
  },
  separator: {
    height: 1,
    backgroundColor: DSColors.borderLight,
    marginLeft: DSLayout.cardPadding + 44,
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  rowHn: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  rowLast: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chevron: {
    marginTop: 2,
  },
});
