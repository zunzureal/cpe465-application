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
  Modal,
  Button,
  Switch,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
// Header is provided by the app Stack; do not render it inline here to avoid duplicates.
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { getDoctorPatients, type DoctorPatient, createPatient, putPatientPreset } from '@/services/apiClient';
import ManagePatientScreen from '@/app/doctor/patient/[id]';

type Patient = DoctorPatient & {
  status: string;
  lastSession?: string;
  program: string;
};

export function DoctorOverviewDashboard() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const { authToken } = useAuth();
  const isTablet = width >= 768;

  // Responsive breakpoints for modal sizing
  // breakpoints (px): small <480, medium 480-767, tablet 768-1023, desktop 1024-1399, xl >=1400
  let sideGap = 16;
  if (width >= 1400) sideGap = 80;
  else if (width >= 1200) sideGap = 60;
  else if (width >= 1024) sideGap = 48;
  else if (width >= 768) sideGap = 32;
  else if (width >= 480) sideGap = 24;

  const maxCardWidth = 1200;
  const cardWidthPx = Math.min(maxCardWidth, Math.max(320, width - sideGap * 2));
  const overlayPaddingHorizontal = sideGap;
  const isSmall = width < 480;
  const contentPadding = Math.min(48, Math.max(12, Math.round(sideGap / 1.5)));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [managePatientId, setManagePatientId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newHn, setNewHn] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newSurgeryLocation, setNewSurgeryLocation] = useState('');
  const [newMachine, setNewMachine] = useState('');

  const router = useRouter();

  // Fetch doctor's patients on mount
  async function fetchPatients() {
    if (!authToken) {
      setError('ไม่มีสิทธิ์เข้าถึง');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getDoctorPatients(authToken);
      if (!response.success || !response.data?.patients) {
        setError(response.error || 'ไม่สามารถโหลดรายชื่อผู้ป่วย');
        setPatients([]);
        return;
      }

      const displayPatients: Patient[] = response.data.patients.map((p) => ({
        ...p,
        program: 'เข่าขวา',
        status: 'รอดำเนินการ',
        lastSession: undefined,
      }));

      setPatients(displayPatients);
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Fetch error:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPatients();
  }, [authToken]);

  async function handleAddPatient() {
    if (!authToken) return;
    try {
      const fullName = `${newName.trim()} ${newLastName.trim()}`.trim();
      const payload = {
        name: fullName || undefined,
        hnCode: newHn.trim(),
        phoneNumber: newPhone.trim(),
        age: newAge ? Number(newAge) : undefined,
      };
      const res = await createPatient(authToken, payload);
      if (!res.success) {
        alert(res.error || 'ไม่สามารถเพิ่มผู้ป่วยได้');
        return;
      }
      setShowAddModal(false);
      setNewName('');
      setNewLastName('');
      setNewHn('');
      setNewPhone('');
      setNewAge('');
      setNewGender('');
      setNewSurgeryLocation('');
      setNewMachine('');
      await fetchPatients();
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Add patient error:', err);
      alert('เกิดข้อผิดพลาดขณะเพิ่มผู้ป่วย');
    }
  }

  async function handleSavePlan() {
    // manage-plan flow moved to dedicated screen; no-op here
  }

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.hnCode.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate summary stats
  const totalPatients = patients.length;
  const completedToday = patients.filter((p) => p.status === 'ครบแล้ว').length;
  const alerts = patients.filter((p) => p.status === 'แจ้งเตือน').length;

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
        {/* Header provided by RootLayout Stack */}
        {/* button moved into patient list section for better layout */}

        {/* Add Patient Modal */}
        <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
          <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={[styles.addModal, { padding: DSLayout.screenPadding }]}>
              <ThemedText type="title" style={{ marginBottom: 12, color: DSColors.text.primary }}>ข้อมูลผู้ป่วย (Patient Information)</ThemedText>

                <View style={styles.rowSplit}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>ชื่อ (First Name)</ThemedText>
                    <TextInput placeholder="ชื่อจริง" placeholderTextColor={DSColors.text.secondary} value={newName} onChangeText={setNewName} style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>นามสกุล (Last Name)</ThemedText>
                    <TextInput placeholder="นามสกุล" placeholderTextColor={DSColors.text.secondary} value={newLastName} onChangeText={setNewLastName} style={styles.input} />
                  </View>
                </View>

                <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>รหัสผู้ป่วย / HN (Hospital Number)</ThemedText>
                <TextInput placeholder="เช่น HN123456" placeholderTextColor={DSColors.text.secondary} value={newHn} onChangeText={setNewHn} style={styles.input} />

                <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>เบอร์โทรศัพท์ (Phone Number) *</ThemedText>
                <TextInput placeholder="08XXXXXXXX" placeholderTextColor={DSColors.text.secondary} value={newPhone} onChangeText={setNewPhone} style={styles.input} keyboardType="phone-pad" />
                <ThemedText type="default" style={{ marginBottom: 10, color: DSColors.text.secondary }}>ใช้สำหรับให้ผู้ป่วยเข้าสู่ระบบแอปพลิเคชัน (Used for patient app login)</ThemedText>

                <View style={styles.rowSplit}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>อายุ (Age)</ThemedText>
                    <TextInput placeholder="เช่น 45" placeholderTextColor={DSColors.text.secondary} value={newAge} onChangeText={setNewAge} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>เพศ (Gender)</ThemedText>
                    <Pressable style={styles.selectBox} onPress={() => { /* future: open gender picker */ }}>
                      <Text style={{ color: newGender ? DSColors.text.primary : DSColors.text.secondary }}>{newGender || '— เลือกเพศ —'}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={{ height: 12 }} />
                <ThemedText type="title" style={{ marginBottom: 12, color: DSColors.text.primary }}>ข้อมูลการรักษาและอุปกรณ์ (Treatment & Device)</ThemedText>
                <ThemedText type="subtitle" style={{ marginBottom: 6, color: DSColors.text.primary }}>บริเวณที่ผ่าตัด (Surgery Type / Location)</ThemedText>
                <Pressable style={styles.selectBox} onPress={() => { /* future: open surgery picker */ }}>
                  <Text style={{ color: newSurgeryLocation ? DSColors.text.primary : DSColors.text.secondary }}>{newSurgeryLocation || '— เลือกบริเวณ —'}</Text>
                </Pressable>

                <ThemedText type="subtitle" style={{ marginTop: 10, marginBottom: 6, color: DSColors.text.primary }}>เลือกเครื่องกายภาพ (Assign Machine)</ThemedText>
                <Pressable style={styles.selectBox} onPress={() => { /* future: open machine picker */ }}>
                  <Text style={{ color: newMachine ? DSColors.text.primary : DSColors.text.secondary }}>{newMachine || '— เลือกเครื่อง —'}</Text>
                </Pressable>
              <View style={styles.addModalActions}>
                <Pressable
                  onPress={() => setShowAddModal(false)}
                  style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
                >
                  <Text style={styles.outlineButtonText}>ยกเลิก</Text>
                </Pressable>

                <Pressable
                  onPress={handleAddPatient}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
                >
                  <Text style={styles.primaryButtonText}>บันทึก</Text>
                </Pressable>
              </View>
            </ThemedView>
          </SafeAreaView>
        </Modal>

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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>รายชื่อผู้ป่วย</Text>
            <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButtonText}>+ เพิ่มผู้ป่วย</Text>
            </Pressable>
          </View>

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
                <Pressable onPress={() => { setManagePatientId(item.id); setShowManageModal(true); }}>
                  <PatientRow item={item} />
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={filtered.length === 0 ? styles.listContentEmpty : undefined}
              scrollEnabled={!isTablet}
            />
          </View>
          {/* Manage Patient Modal (popup) */}
          <Modal visible={showManageModal} animationType="none" transparent onRequestClose={() => setShowManageModal(false)}>
            <View style={[styles.modalOverlay, { paddingHorizontal: overlayPaddingHorizontal }] }>
              <View style={isSmall ? styles.modalCardFull : [styles.modalCardWrapper, { width: cardWidthPx }] }>
                <ScrollView contentContainerStyle={styles.modalScrollContent}>
                  {managePatientId !== null && (
                    <View style={[styles.modalContentWrap, { paddingHorizontal: contentPadding }] }>
                      <ManagePatientScreen patientIdProp={managePatientId} embedded onClose={() => setShowManageModal(false)} />
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
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
    maxWidth: 1200,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  addModal: {
    flex: 1,
    backgroundColor: DSColors.surface,
  },
  input: {
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 12,
    borderRadius: DSShape.radiusButton,
    marginBottom: 10,
    backgroundColor: DSColors.surface,
    color: DSColors.text.primary,
  },
  addModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  addButtonText: {
    color: DSColors.text.inverse,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 1200,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalCardWeb: {
    width: '100%',
    maxWidth: 1200,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    overflow: 'hidden',
    maxHeight: '90%',
    alignSelf: 'center',
  },
  modalCardFull: {
    width: '100%',
    height: '100%',
    backgroundColor: DSColors.surface,
    borderRadius: 0,
    overflow: 'hidden',
  },
  
  modalContentWrap: {
    paddingTop: 24,
    paddingHorizontal: DSLayout.screenPadding,
    paddingBottom: 24,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    marginRight: 8,
  },
  outlineButtonText: {
    color: DSColors.text.primary,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DSShape.radiusButton,
  },
  primaryPressed: {
    backgroundColor: DSColors.primaryDark,
  },
  primaryButtonText: {
    color: DSColors.text.inverse,
    fontWeight: '700',
  },
  pressed: { opacity: 0.8 },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    justifyContent: 'center',
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
