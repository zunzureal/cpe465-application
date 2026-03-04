/**
 * Doctor Overview Dashboard – Clean, modern, tablet-friendly.
 * Summary cards (Total Patients, Completed Today, Alerts) + patient list with search.
 */

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
const MOCK_SUMMARY = {
  totalPatients: 24,
  completedToday: 8,
  alerts: 2,
};

const MOCK_PATIENTS = [
  { id: '1', name: 'คุณสมชาย ใจดี', program: 'เข่าขวา', status: 'กำลังรักษา', lastSession: 'วันนี้ 09:00' },
  { id: '2', name: 'คุณอารยา พูนสุข', program: 'ข้อไหล่ซ้าย', status: 'รอดำเนินการ', lastSession: 'เมื่อวาน' },
  { id: '3', name: 'คุณประเสริฐ มั่นคง', program: 'หลังส่วนล่าง', status: 'ครบแล้ว', lastSession: 'วันนี้ 10:30' },
  { id: '4', name: 'คุณวิภา งามแสง', program: 'เข่าซ้าย', status: 'กำลังรักษา', lastSession: 'วันนี้ 08:00' },
  { id: '5', name: 'คุณสมศักดิ์ ใจดี', program: 'ข้อมือขวา', status: 'รอดำเนินการ', lastSession: '2 วันก่อน' },
];

type Patient = (typeof MOCK_PATIENTS)[0];

export function DoctorOverviewDashboard() {
  const [search, setSearch] = useState('');
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const filtered = MOCK_PATIENTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.program.toLowerCase().includes(search.toLowerCase())
  );

  const summaryCards = [
    {
      key: 'total',
      label: 'ผู้ป่วยทั้งหมด',
      value: MOCK_SUMMARY.totalPatients,
      icon: 'people' as const,
      color: DSColors.primary,
      bg: DSColors.primaryLight,
    },
    {
      key: 'completed',
      label: 'ทำครบวันนี้',
      value: MOCK_SUMMARY.completedToday,
      icon: 'checkmark-circle' as const,
      color: DSColors.success,
      bg: DSColors.successLight,
    },
    {
      key: 'alerts',
      label: 'แจ้งเตือน',
      value: MOCK_SUMMARY.alerts,
      icon: 'warning' as const,
      color: DSColors.danger,
      bg: DSColors.dangerLight,
    },
  ];

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
              placeholder="ค้นหาชื่อหรือโปรแกรม..."
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
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>ไม่พบผู้ป่วยที่ตรงกับคำค้น</Text>
                </View>
              }
              renderItem={({ item }) => (
                <PatientRow item={item} />
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

function PatientRow({ item }: { item: Patient }) {
  const statusColor =
    item.status === 'กำลังรักษา'
      ? DSColors.primary
      : item.status === 'ครบแล้ว'
        ? DSColors.success
        : DSColors.text.secondary;

  return (
    <View style={styles.row}>
      <View style={styles.rowAvatar}>
        <Ionicons name="person" size={22} color={DSColors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowProgram}>{item.program}</Text>
        <Text style={styles.rowLast}>{item.lastSession}</Text>
      </View>
      <View style={[styles.statusChip, { backgroundColor: `${statusColor}18` }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
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
    ...Platform.select({ web: { outlineStyle: 'none' } }),
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
  rowProgram: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  rowLast: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DSShape.radiusChip,
  },
  statusText: {
    ...DSTypography.captionBold,
  },
});
