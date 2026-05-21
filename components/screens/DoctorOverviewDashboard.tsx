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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
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
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { getDoctorPatients, type DoctorPatient, createPatient, putPatientPreset, deletePatient, updatePatient } from '@/services/apiClient';
// ManagePatientScreen is a separate route now — navigate to it instead of embedding

type Patient = DoctorPatient & {
  status: string;
  lastSession?: string;
  program: string;
};

type AddPatientPicker = 'gender' | 'surgery' | 'machine' | null;

type PickerOption = {
  label: string;
  value: string;
};

export function DoctorOverviewDashboard() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isAndroid = Platform.OS === 'android';
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
  const tabletListMaxHeight = isTablet ? Math.max(320, height - 250) : undefined;
  const contentPadding = Math.min(48, Math.max(12, Math.round(sideGap / 1.5)));
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newHn, setNewHn] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newSurgeryLocation, setNewSurgeryLocation] = useState('');
  const [newMachine, setNewMachine] = useState('');
  const [activePicker, setActivePicker] = useState<AddPatientPicker>(null);
  const [pickerCallback, setPickerCallback] = useState<((v: string) => void) | null>(null);

  const router = useRouter();

  const pickerTitleMap: Record<Exclude<AddPatientPicker, null>, string> = {
    gender: 'เลือกเพศ',
    surgery: 'เลือกบริเวณที่ผ่าตัด',
    machine: 'เลือกเครื่องกายภาพ',
  };

  const pickerOptionsMap: Record<Exclude<AddPatientPicker, null>, PickerOption[]> = {
    gender: [
      { label: 'ชาย', value: 'ชาย' },
      { label: 'หญิง', value: 'หญิง' },
      { label: 'ไม่ระบุ', value: 'ไม่ระบุ' },
    ],
    surgery: [
      { label: 'เข่าขวา', value: 'เข่าขวา' },
      { label: 'เข่าซ้าย', value: 'เข่าซ้าย' },
      { label: 'สะโพกขวา', value: 'สะโพกขวา' },
      { label: 'สะโพกซ้าย', value: 'สะโพกซ้าย' },
      { label: 'ไหล่', value: 'ไหล่' },
      { label: 'อื่นๆ', value: 'อื่นๆ' },
    ],
    machine: [
      { label: 'Machine A', value: 'Machine A' },
      { label: 'Machine B', value: 'Machine B' },
      { label: 'Machine C', value: 'Machine C' },
      { label: 'Machine D', value: 'Machine D' },
    ],
  };

  function openPicker(kind: Exclude<AddPatientPicker, null>, cb?: (v: string) => void) {
    setActivePicker(kind);
    setPickerCallback(cb || null);
  }

  function closePicker() {
    setActivePicker(null);
  }

  function handlePickerSelect(value: string) {
    if (activePicker === 'gender') {
      setNewGender(value);
    }
    if (activePicker === 'surgery') setNewSurgeryLocation(value);
    if (activePicker === 'machine') setNewMachine(value);
    // call any callback provided by the opener (e.g., PatientRow's setEditGender)
    try {
      if (pickerCallback) pickerCallback(value);
    } catch (e) {
      // ignore
    }
    setPickerCallback(null);
    setActivePicker(null);
  }

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
        status: '',
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
      const hospitalNumber = newHn.trim();
      const parsedAge = Number(newAge);

      if (!newName.trim() || !newLastName.trim()) {
        alert('กรุณากรอกชื่อและนามสกุล');
        return;
      }
      // Ensure name contains only Thai letters and spaces
      const thaiOnly = /^[\u0E00-\u0E7F\s]+$/;
      if (!thaiOnly.test(fullName)) {
        alert('ชื่อและนามสกุลต้องเป็นตัวอักษรภาษาไทยเท่านั้น');
        return;
      }
      if (!hospitalNumber) {
        alert('กรุณากรอก Hospital Number (HN)');
        return;
      }
      if (!newGender) {
        alert('กรุณาเลือกเพศ');
        return;
      }
      if (!newPhone.trim() || newPhone.trim().length !== 10) {
        alert('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
        return;
      }
      if (!newAge.trim() || Number.isNaN(parsedAge) || Number(parsedAge) < 0) {
        alert('กรุณากรอกอายุเป็นตัวเลขบวก');
        return;
      }

      const payload = {
        name: fullName,
        hospitalNumber,
        hnCode: hospitalNumber,
        phoneNumber: newPhone.trim(),
        gender: newGender,
        age: parsedAge,
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

        {/* Add Patient Modal — same layout as Edit modal (plan modal style) */}
        <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
          <View style={styles.editModalOverlay}>
            <View style={styles.editModalCard}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>เพิ่มผู้ป่วย</Text>
                <Pressable onPress={() => setShowAddModal(false)} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 18, color: DSColors.text.secondary, fontWeight: '600' }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.rowSplit}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                      ชื่อ (First Name)
                      <Text style={{ color: DSColors.danger }}> *</Text>
                    </ThemedText>
                    <TextInput
                      placeholder="ชื่อจริง"
                      placeholderTextColor={DSColors.text.secondary}
                      value={newName}
                      onChangeText={(text) => {
                        // Allow only Thai characters and spaces while typing
                        const sanitized = text.replace(/[^\u0E00-\u0E7F\s]/g, '');
                        setNewName(sanitized);
                      }}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                      นามสกุล (Last Name)
                      <Text style={{ color: DSColors.danger }}> *</Text>
                    </ThemedText>
                    <TextInput
                      placeholder="นามสกุล"
                      placeholderTextColor={DSColors.text.secondary}
                      value={newLastName}
                      onChangeText={(text) => {
                        const sanitized = text.replace(/[^\u0E00-\u0E7F\s]/g, '');
                        setNewLastName(sanitized);
                      }}
                      style={styles.input}
                    />
                  </View>
                </View>

                <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                  รหัสผู้ป่วย / HN (Hospital Number)
                  <Text style={{ color: DSColors.danger }}> *</Text>
                </ThemedText>
                <TextInput placeholder="เช่น HN123456" placeholderTextColor={DSColors.text.secondary} value={newHn} onChangeText={setNewHn} style={styles.input} />

                <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                  เบอร์โทรศัพท์ (Phone Number)
                  <Text style={{ color: DSColors.danger }}> *</Text>
                </ThemedText>
                <TextInput
                  placeholder="08XXXXXXXX"
                  placeholderTextColor={DSColors.text.secondary}
                  value={newPhone}
                  onChangeText={(text) => {
                    // Allow only digits and limit to 10 characters
                    const digits = text.replace(/\D/g, '').slice(0, 10);
                    setNewPhone(digits);
                  }}
                  maxLength={10}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
                <ThemedText type="default" style={{ fontSize: 12, marginLeft: 4,marginBottom: 10, color: DSColors.text.secondary }}>ใช้สำหรับให้ผู้ป่วยเข้าสู่ระบบแอปพลิเคชัน (Used for patient app login)</ThemedText>

                <View style={styles.rowSplit}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                      อายุ (Age)
                      <Text style={{ color: DSColors.danger }}> *</Text>
                    </ThemedText>
                    <TextInput
                      placeholder="เช่น 45"
                      placeholderTextColor={DSColors.text.secondary}
                      value={newAge}
                      onChangeText={(text) => {
                        // Allow only digits and prevent negative values
                        const digits = text.replace(/\D/g, '');
                        setNewAge(digits);
                      }}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                      เพศ (Gender)
                      <Text style={{ color: DSColors.danger }}> *</Text>
                    </ThemedText>
                    <Pressable style={styles.selectBox} onPress={() => openPicker('gender')}>
                      <Text style={{ color: newGender ? DSColors.text.primary : DSColors.text.secondary }}>{newGender || '— เลือกเพศ —'}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* <View style={{ height: 12 }} />
                <ThemedText type="title" style={{ fontSize: 22, marginBottom: 12, color: DSColors.text.primary }}>ข้อมูลการรักษาและอุปกรณ์ (Treatment & Device)</ThemedText> */}
                {/* <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>บริเวณที่ผ่าตัด (Surgery Type / Location)</ThemedText>
                <Pressable style={styles.selectBox} onPress={() => openPicker('surgery')}>
                  <Text style={{ color: newSurgeryLocation ? DSColors.text.primary : DSColors.text.secondary }}>{newSurgeryLocation || '— เลือกบริเวณ —'}</Text>
                </Pressable> */}

                  {/* <ThemedText type="subtitle" style={{ fontSize: 16, marginTop: 10, marginBottom: 6, color: DSColors.text.primary }}>เลือกเครื่องกายภาพ (Assign Machine)</ThemedText>
                  <Pressable style={styles.selectBox} onPress={() => openPicker('machine')}>
                    <Text style={{ color: newMachine ? DSColors.text.primary : DSColors.text.secondary }}>{newMachine || '— เลือกเครื่อง —'}</Text>
                  </Pressable> */}
              </ScrollView>

              <View style={styles.editModalFooter}>
                <Pressable onPress={() => setShowAddModal(false)} style={[styles.editOutlineButton, { flex: 1 }]}>
                  <Text style={[styles.editOutlineButtonText, { textAlign: 'center' }]}>ยกเลิก</Text>
                </Pressable>
                <Pressable onPress={handleAddPatient} style={[styles.editPrimaryButton, { flex: 2 }]}>
                  <Text style={[styles.editPrimaryButtonText, { textAlign: 'center' }]}>บันทึก</Text>
                </Pressable>
              </View>
            </View>
          </View>
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

          {isAndroid && isTablet ? (
            <View style={{ flex: 1, backgroundColor: DSColors.background }}>
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>ไม่พบผู้ป่วยที่ตรงกับคำค้นหา</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { router.push(`/doctor/patient/${item.id}`); }}
                    activeOpacity={0.7}
                    style={styles.rowPressable}
                  >
                    <PatientRow item={item} onOpenPicker={(kind, cb) => { setActivePicker(kind); setPickerCallback(cb || null); }} />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={filtered.length === 0 ? styles.listContentEmpty : undefined}
                scrollEnabled
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                style={[styles.list, { backgroundColor: 'transparent' }]}
              />
            </View>
          ) : (
            <View style={[styles.listCardShadow, !isAndroid && DSShadow, isAndroid && isTablet && styles.androidTabletShadowFallback]}>
              <View style={[styles.listCard, isTablet && { maxHeight: tabletListMaxHeight }, isAndroid && isTablet && styles.androidTabletListFallback]}>
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => String(item.id)}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Text style={styles.emptyText}>ไม่พบผู้ป่วยที่ตรงกับคำค้นหา</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => { router.push(`/doctor/patient/${item.id}`); }}
                        activeOpacity={0.7}
                        style={styles.rowPressable}
                      >
                        <PatientRow item={item} onOpenPicker={(kind, cb) => { setActivePicker(kind); setPickerCallback(cb || null); }} />
                      </TouchableOpacity>
                    )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  contentContainerStyle={filtered.length === 0 ? styles.listContentEmpty : undefined}
                  scrollEnabled
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  removeClippedSubviews={false}
                  style={styles.list}
                />
              </View>
            </View>
          )}
          {/* ManagePatient now opens as a separate page via router.push(...) */}
        </View>
      </View>
            {/* Picker modal rendered last so it appears above other modals (Edit/Add) */}
            <Modal visible={activePicker !== null} transparent animationType="fade" onRequestClose={closePicker}>
              <Pressable style={styles.pickerOverlay} onPress={closePicker}>
                <Pressable style={[styles.pickerCard, DSShadowSoft]} onPress={() => {}}>
                  <Text style={styles.pickerTitle}>{activePicker ? pickerTitleMap[activePicker] : ''}</Text>
                  {(activePicker ? pickerOptionsMap[activePicker] : []).map((option) => (
                    <Pressable
                      key={option.value}
                      style={({ pressed }) => [styles.pickerOption, pressed && styles.pickerOptionPressed]}
                      onPress={() => handlePickerSelect(option.value)}
                    >
                      <Text style={styles.pickerOptionText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </Pressable>
              </Pressable>
            </Modal>
        </SafeAreaView>
  );
}

function PatientRow({ item, onOpenPicker }: { item: Patient; onOpenPicker?: (kind: Exclude<AddPatientPicker, null>, cb?: (v: string) => void) => void }) {
  const statusColor =
    item.status === 'กำลังรักษา'
      ? DSColors.primary
      : item.status === 'ครบแล้ว'
        ? DSColors.success
        : DSColors.text.secondary;

  // local UI state for actions
  const [busy, setBusy] = useState(false);
  const { authToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editHn, setEditHn] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('');

  // Open edit modal and pre-fill data
  function openEditModal() {
    const parts = item.name.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    setEditName(firstName);
    setEditLastName(lastName);
    setEditHn(item.hnCode || '');
    setEditPhone(item?.phoneNumber || '');
    setEditGender(item?.gender || '');
    setEditAge(item?.age?.toString() || '');
    setEditModalVisible(true);
  }

  async function handleSaveEdit() {
    if (!authToken) {
      alert('ไม่มีสิทธิ์');
      return;
    }
    const fullName = `${editName.trim()} ${editLastName.trim()}`.trim();
    if (!fullName) {
      alert('กรุณากรอกชื่อและนามสกุล');
      return;
    }
    const thaiOnly = /^[\u0E00-\u0E7F\s]+$/;
    if (!thaiOnly.test(fullName)) {
      alert('ชื่อและนามสกุลต้องเป็นตัวอักษรภาษาไทยเท่านั้น');
      return;
    }
    if (!editHn.trim()) {
      alert('กรุณากรอก Hospital Number (HN)');
      return;
    }
    if (!editGender) {
      alert('กรุณาเลือกเพศ');
      return;
    }
    if (!editPhone.trim() || editPhone.trim().length !== 10) {
      alert('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }
    const parsedAge = Number(editAge);
    if (!editAge.trim() || Number.isNaN(parsedAge) || parsedAge < 0) {
      alert('กรุณากรอกอายุเป็นตัวเลขบวก');
      return;
    }

    setBusy(true);
    try {
      const res = await updatePatient(authToken, item.id, {
        name: fullName,
        hnCode: editHn.trim(),
        phoneNumber: editPhone.trim(),
        age: parsedAge,
        gender: editGender,
      });
      if (!res.success) {
        alert(res.error || 'ไม่สามารถบันทึกการแก้ไขได้');
      } else {
        alert('บันทึกการแก้ไขเสร็จแล้ว');
        setEditModalVisible(false);
        // Refresh page to show updated data
        router.replace(pathname as any);
      }
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Edit error:', err);
      alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ป่วย');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!authToken) {
      alert('ไม่มีสิทธิ์');
      return;
    }
    setBusy(true);
    try {
      const res = await deletePatient(authToken, item.id);
      if (!res.success) {
        alert(res.error || 'ไม่สามารถลบผู้ป่วยได้ (backend may not support delete)');
      } else {
        // refresh list by emitting a navigation refresh (simpler) — rely on parent page to refetch on focus
        router.replace(pathname as any);
      }
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Delete error:', err);
      alert('เกิดข้อผิดพลาดในการลบผู้ป่วย');
    } finally {
      setBusy(false);
      setConfirmDeleteVisible(false);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowAvatar}>
        <Ionicons name="person" size={22} color={DSColors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.name?.trim() || 'ไม่ระบุชื่อผู้ป่วย'}</Text>
        <Text style={styles.rowProgram}>{item.program}</Text>
        {!!item.lastSession && <Text style={styles.rowLast}>{item.lastSession}</Text>}
      </View>
      {/* <View style={[styles.statusChip, { backgroundColor: `${statusColor}18` }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
      </View> */}

      {/* Action icons: Edit and Delete */}
      <View style={styles.rowActions}>
        <Pressable
          onPress={openEditModal}
          style={({ pressed }) => pressed && styles.pressed}
          hitSlop={8}
          accessibilityLabel="Edit patient"
        >
          <View style={styles.iconButtonEdit}>
            <Ionicons name="pencil" size={22} color={DSColors.warning} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => setConfirmDeleteVisible(true)}
          style={({ pressed }) => pressed && styles.pressed}
          hitSlop={8}
          accessibilityLabel="Delete patient"
        >
          <View style={styles.iconButtonDelete}>
            <Ionicons name="trash" size={22} color={DSColors.danger} />
          </View>
        </Pressable>

        {/* Edit Modal — same layout as plan modal in app/doctor/patient/[id].tsx */}
        <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.editModalOverlay}>
            <View style={styles.editModalCard}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>ปรับข้อมูลผู้ป่วย</Text>
                <Pressable onPress={() => setEditModalVisible(false)} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 18, color: DSColors.text.secondary, fontWeight: '600' }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                  <View style={styles.rowSplit}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                        ชื่อ
                        <Text style={{ color: DSColors.danger }}> *</Text>
                      </ThemedText>
                      <TextInput
                        placeholder="ชื่อจริง"
                        placeholderTextColor={DSColors.text.secondary}
                        value={editName}
                        onChangeText={(text) => {
                          const sanitized = text.replace(/[^\u0E00-\u0E7F\s]/g, '');
                          setEditName(sanitized);
                        }}
                        style={styles.input}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                        นามสกุล
                        <Text style={{ color: DSColors.danger }}> *</Text>
                      </ThemedText>
                      <TextInput
                        placeholder="นามสกุล"
                        placeholderTextColor={DSColors.text.secondary}
                        value={editLastName}
                        onChangeText={(text) => {
                          const sanitized = text.replace(/[^\u0E00-\u0E7F\s]/g, '');
                          setEditLastName(sanitized);
                        }}
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                    รหัสผู้ป่วย (HN)
                    <Text style={{ color: DSColors.danger }}> *</Text>
                  </ThemedText>
                  <TextInput placeholder="เช่น HN123456" placeholderTextColor={DSColors.text.secondary} value={editHn} onChangeText={setEditHn} style={styles.input} />

                  <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>เบอร์โทรศัพท์ *</ThemedText>
                  <TextInput
                    placeholder="08XXXXXXXX"
                    placeholderTextColor={DSColors.text.secondary}
                    value={editPhone}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '').slice(0, 10);
                      setEditPhone(digits);
                    }}
                    maxLength={10}
                    style={styles.input}
                    keyboardType="phone-pad"
                  />

                  <View style={styles.rowSplit}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                        อายุ
                        <Text style={{ color: DSColors.danger }}> *</Text>
                      </ThemedText>
                      <TextInput
                        placeholder="เช่น 45"
                        placeholderTextColor={DSColors.text.secondary}
                        value={editAge}
                        onChangeText={(text) => {
                          const digits = text.replace(/\D/g, '');
                          setEditAge(digits);
                        }}
                        keyboardType="numeric"
                        style={styles.input}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 6, color: DSColors.text.primary }}>
                        เพศ (Gender)
                        <Text style={{ color: DSColors.danger }}> *</Text>
                      </ThemedText>
                      <Pressable style={styles.selectBox} onPress={() => onOpenPicker && onOpenPicker('gender', (v: string) => setEditGender(v))}>
                        <Text style={{ color: editGender ? DSColors.text.primary : DSColors.text.secondary }}>{editGender || '— เลือกเพศ —'}</Text>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>

              <View style={styles.editModalFooter}>
                <Pressable onPress={() => setEditModalVisible(false)} style={[styles.editOutlineButton, { flex: 1 }]}>
                  <Text style={[styles.editOutlineButtonText, { textAlign: 'center' }]}>ยกเลิก</Text>
                </Pressable>
                <Pressable
                  onPress={() => { if (!busy) handleSaveEdit(); }}
                  style={[styles.editPrimaryButton, { flex: 2, opacity: busy ? 0.6 : 1 }]}
                >
                  <Text style={[styles.editPrimaryButtonText, { textAlign: 'center' }]}>
                    {busy ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal visible={confirmDeleteVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setConfirmDeleteVisible(false)}>
            <View style={[styles.modalCardWrapper, { padding: DSLayout.screenPadding, width: 320 }]}>
              <Text style={{ ...DSTypography.h3, color: DSColors.text.primary, marginBottom: 12 }}>ยืนยันการลบ</Text>
              <Text style={{ ...DSTypography.body, color: DSColors.text.secondary, marginBottom: 20 }}>คุณแน่ใจว่าต้องการลบผู้ป่วยนี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</Text>
              <Text style={{ ...DSTypography.body, color: DSColors.text.secondary, marginBottom: 20 }}>
                {`คุณแน่ใจว่าต้องการลบผู้ป่วย ${item.name || ''} ${item.hnCode || ''} นี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setConfirmDeleteVisible(false)} style={styles.outlineButton}>
                  <Text style={styles.outlineButtonText}>ยกเลิก</Text>
                </Pressable>
                <Pressable onPress={handleDelete} style={[styles.primaryButton, busy && { opacity: 0.6 }]}>
                  <Text style={styles.primaryButtonText}>{busy ? '' : 'ลบ'}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
    marginTop: 12,
  },
  errorText: {
    ...DSTypography.body,
    color: DSColors.danger,
    marginTop: 12,
    textAlign: 'center',
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
    minHeight: 0,
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
    flexWrap: 'wrap',
    rowGap: 8,
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
    minHeight: 260,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    overflow: 'hidden',
  },
  listCardShadow: {
    flex: 1,
    borderRadius: DSShape.radiusCard,
    backgroundColor: DSColors.surface,
    ...Platform.select({
      android: { elevation: 2 },
      default: {},
    }),
  },
  // Android tablet fallback: disable elevation and avoid clipping artifacts
  androidTabletShadowFallback: {
    // remove elevation which can interact badly with overflow on some Android devices
    elevation: 0,
    // keep a neutral background so visual doesn't change
    backgroundColor: DSColors.surface,
    // allow children to render outside bounds when needed
    overflow: 'visible',
  },
  androidTabletListFallback: {
    // remove rounded clipping to avoid rendering artifacts on Android tablets
    borderRadius: 0,
    overflow: 'visible',
  },
  list: {
    flex: 1,
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
  addModalShell: {
    flex: 1,
    backgroundColor: DSColors.surface,
    position: 'relative',
  },
  addModalKeyboardWrap: {
    flex: 1,
  },
  // Edit modal — copied verbatim from plan modal in app/doctor/patient/[id].tsx
  editModalOverlay: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  editModalCard: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  editModalTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
  },
  editModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
    backgroundColor: DSColors.background,
  },
  editOutlineButton: {
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    alignItems: 'center',
  },
  editOutlineButtonText: {
    color: DSColors.text.primary,
    fontWeight: '700',
  },
  editPrimaryButton: {
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
  },
  editPrimaryButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  addModalBody: {
    flex: 1,
    backgroundColor: DSColors.surface,
  },
  addModalScroll: {
    backgroundColor: DSColors.surface,
    paddingBottom: 120,
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
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: DSLayout.screenPadding,
    paddingVertical: 12,
    backgroundColor: DSColors.surface,
  },
  addModalActionsFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: DSColors.borderLight,
    backgroundColor: DSColors.surface,
    zIndex: 10,
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DSLayout.screenPadding,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.screenPadding,
  },
  pickerTitle: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 12,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: DSColors.surface,
  },
  pickerOptionPressed: {
    backgroundColor: DSColors.primaryLight,
  },
  pickerOptionText: {
    ...DSTypography.body,
    color: DSColors.text.primary,
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: DSColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginLeft: 8,
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
  manageTabletScreen: {
    flex: 1,
    backgroundColor: DSColors.background,
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
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: DSLayout.screenPadding,
    paddingBottom: 24,
  },
  outlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: DSColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    backgroundColor: DSColors.surface,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: DSColors.text.primary,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: DSColors.primary,
    width: '50%',
    justifyContent: 'center',
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
  },
  primaryPressed: {
    backgroundColor: DSColors.primaryDark,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    justifyContent: 'center',
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
    justifyContent:"space-between",
    minHeight: 74,
    paddingVertical: 14,
    paddingHorizontal: DSLayout.cardPadding,
    backgroundColor: DSColors.surface,
  },
  rowPressable: {
    backgroundColor: DSColors.surface,
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
  rowBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
    // borderWidth: 1,
    //width:60
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.surface,
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  // Match summaryIconWrap style exactly so the block tint reads identically
  iconButtonEdit: {
    width: 48,
    height: 48,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.warningLight,
  },
  iconButtonDelete: {
    width: 48,
    height: 48,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft:4,
    backgroundColor: DSColors.dangerLight,
  },
  actionButtonEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    marginLeft: 8,
    backgroundColor: DSColors.primaryLight,
    borderWidth: 1,
    borderColor: DSColors.primary,
  },
  actionButtonEditText: {
    ...DSTypography.captionBold,
    color: DSColors.primary,
  },
  actionButtonDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: DSShape.radiusButton,
    marginLeft: 8,
    backgroundColor: DSColors.dangerLight,
    borderWidth: 1,
    borderColor: DSColors.danger,
  },
  actionButtonDeleteText: {
    ...DSTypography.captionBold,
    color: DSColors.danger,
  },
});
