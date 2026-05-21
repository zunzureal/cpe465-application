/**
 * Doctor Overview Dashboard – Clean, modern, tablet-friendly.
 * Summary cards (Total Patients, Completed Today, Alerts) + patient list with search.
 * Fetches real patient data from database.
 */

import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
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
import { PatientFormFields } from '@/components/forms/PatientFormFields';
import {
  clearFieldError,
  hasAnyFieldError,
  type FieldErrors,
} from '@/components/ui/RequiredField';
import { collectPatientFormEmptyErrors } from '@/utils/patientFormValidation';

import {
  DSColors,
  DSLayout,
  DSShadow,
  DSShadowSoft,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDoctorPatients,
  getDoctorPatient,
  type DoctorPatient,
  type DoctorPatientDashboardStatus,
  createPatient,
  putPatientPreset,
  deletePatient,
  updatePatient,
  DUPLICATE_PHONE_MESSAGE,
} from '@/services/apiClient';

type PatientAlertOptions = {
  /** ปิด Modal ก่อนแสดง Alert — กัน Alert ถูก Modal แก้ไข/เพิ่มบัง (โดยเฉพาะตอน edit) */
  dismissModal?: () => void;
  /** หลังกดตกลง */
  onDismiss?: () => void;
};

function showPatientAlert(title: string, message: string, opts?: PatientAlertOptions) {
  opts?.dismissModal?.();
  const delay = opts?.dismissModal ? (Platform.OS === 'web' ? 0 : 280) : 0;
  setTimeout(() => {
    Alert.alert(title, message, [
      { text: 'ตกลง', style: 'default', onPress: opts?.onDismiss },
    ]);
  }, delay);
}

function alertPatientSaveError(error?: string, opts?: PatientAlertOptions) {
  const msg = error?.trim() || '';
  if (
    msg.includes(DUPLICATE_PHONE_MESSAGE) ||
    msg.includes('เบอร์นี้ได้') ||
    msg.includes('ลงทะเบียนแล้ว')
  ) {
    showPatientAlert('แจ้งเตือน', DUPLICATE_PHONE_MESSAGE, opts);
    return;
  }
  if (msg.includes('HN') || msg.includes('โรงพยาบาล')) {
    showPatientAlert('แจ้งเตือน', msg, opts);
    return;
  }
  showPatientAlert('ไม่สามารถบันทึกได้', msg || 'ไม่สามารถบันทึกข้อมูลผู้ป่วยได้', opts);
}
// ManagePatientScreen is a separate route now — navigate to it instead of embedding

type Patient = DoctorPatient & {
  status: DoctorPatientDashboardStatus;
  lastSession?: string;
  program: string;
};

type ListFilter = 'all' | 'completed' | 'alerts';



function buildPatientListMeta(p: DoctorPatient): Pick<Patient, 'status' | 'lastSession' | 'program'> {
  const status = (p.status ?? 'รอแผน') as DoctorPatientDashboardStatus;
  let lastSession: string | undefined;
  if (status === 'แจ้งเตือน' && p.alertLabels?.length) {
    lastSession = p.alertLabels.join(' · ');
  } else if (p.scheduledToday && (p.sessionsTargetToday ?? 0) > 0) {
    lastSession = `วันนี้ ${p.sessionsCompletedToday ?? 0}/${p.sessionsTargetToday} เซสชัน`;
  } else if (status === 'รอแผน') {
    lastSession = 'ยังไม่มีแผนการรักษา';
  }
  return { status, lastSession, program: 'เข่าขวา' };
}

type AddPatientPicker = 'gender' | 'surgery' | 'machine' | null;

type PickerOption = {
  label: string;
  value: string;
};

const GENDER_OPTIONS: PickerOption[] = [
  { label: 'ชาย', value: 'ชาย' },
  { label: 'หญิง', value: 'หญิง' },
  { label: 'ไม่ระบุ', value: 'ไม่ระบุ' },
];

function normalizeGender(value?: string | null): string {
  if (!value) return '';
  const legacy: Record<string, string> = {
    male: 'ชาย',
    female: 'หญิง',
    other: 'ไม่ระบุ',
    MALE: 'ชาย',
    FEMALE: 'หญิง',
  };
  const key = value in legacy ? value : value.toLowerCase();
  return legacy[key] ?? value;
}

/** Inline overlay inside Add/Edit modals — avoids RN Modal stacking issues */
function GenderPickerOverlay({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.genderPickerOverlay}>
      <Pressable style={styles.genderPickerBackdrop} onPress={onClose} />
      <View style={[styles.pickerCard, styles.pickerCardRaised, DSShadowSoft]}>
        <Text style={styles.pickerTitle}>เลือกเพศ</Text>
        {GENDER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={({ pressed }) => [styles.pickerOption, pressed && styles.pickerOptionPressed]}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
          >
            <Text style={styles.pickerOptionText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function DoctorOverviewDashboard() {
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
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
  const [showAddGenderPicker, setShowAddGenderPicker] = useState(false);
  const [addFieldErrors, setAddFieldErrors] = useState<FieldErrors>({});

  const router = useRouter();


  const pickerTitleMap: Record<Exclude<AddPatientPicker, null>, string> = {
    gender: 'เลือกเพศ',
    surgery: 'เลือกบริเวณที่ผ่าตัด',
    machine: 'เลือกเครื่องกายภาพ',
  };

  const pickerOptionsMap: Record<Exclude<AddPatientPicker, null>, PickerOption[]> = {
    gender: GENDER_OPTIONS,
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
        gender: normalizeGender(p.gender),
        ...buildPatientListMeta(p),
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
    const dismissAddModal = () => {
      setShowAddModal(false);
      setShowAddGenderPicker(false);
    };
    const reopenAddModal = () => setShowAddModal(true);
    const addAlertOpts: PatientAlertOptions = {
      dismissModal: dismissAddModal,
      onDismiss: reopenAddModal,
    };
    try {
      const emptyErrors = collectPatientFormEmptyErrors({
        firstName: newName,
        lastName: newLastName,
        hn: newHn,
        phone: newPhone,
        age: newAge,
        gender: newGender,
      });
      setAddFieldErrors(emptyErrors);
      if (hasAnyFieldError(emptyErrors)) return;

      const fullName = `${newName.trim()} ${newLastName.trim()}`.trim();
      const hospitalNumber = newHn.trim();
      const parsedAge = Number(newAge);

      const thaiOnly = /^[\u0E00-\u0E7F\s]+$/;
      if (!thaiOnly.test(fullName)) {
        showPatientAlert('แจ้งเตือน', 'ชื่อและนามสกุลต้องเป็นตัวอักษรภาษาไทยเท่านั้น', addAlertOpts);
        return;
      }
      if (newPhone.trim().length !== 10) {
        showPatientAlert('แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก', addAlertOpts);
        return;
      }
      if (Number.isNaN(parsedAge) || parsedAge < 0) {
        showPatientAlert('แจ้งเตือน', 'กรุณากรอกอายุเป็นตัวเลขบวก', addAlertOpts);
        return;
      }

      const genderValue = newGender.trim();

      const payload = {
        name: fullName,
        hospitalNumber,
        phoneNumber: newPhone.trim(),
        gender: genderValue,
        age: parsedAge,
      };
      const res = await createPatient(authToken, payload);
      if (!res.success) {
        alertPatientSaveError(res.error, addAlertOpts);
        return;
      }
      if ((res.data as { existing?: boolean })?.existing) {
        showPatientAlert('แจ้งเตือน', 'ผู้ป่วยนี้มีอยู่ในระบบแล้ว', addAlertOpts);
        return;
      }
      setShowAddModal(false);
      setAddFieldErrors({});
      setNewName('');
      setNewLastName('');
      setNewHn('');
      setNewPhone('');
      setNewAge('');
      setNewGender('');
      setShowAddGenderPicker(false);
      setNewSurgeryLocation('');
      setNewMachine('');
      await fetchPatients();
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Add patient error:', err);
      showPatientAlert('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดขณะเพิ่มเพิ่มข้อมูลผู้ป่วย', addAlertOpts);
    }
  }

  async function handleSavePlan() {
    // manage-plan flow moved to dedicated screen; no-op here
  }

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) || p.hnCode.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (listFilter === 'completed') return p.status === 'ครบแล้ว';
    if (listFilter === 'alerts') return p.status === 'แจ้งเตือน';
    return true;
  });

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
          <Text style={styles.loadingText}>กำลังโหลดรายชื่อผู้ป่วย</Text>
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
        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowAddModal(false);
            setShowAddGenderPicker(false);
          }}
        >
          <View style={styles.editModalOverlay}>
            <View style={styles.editModalCard}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>เพิ่มข้อมูลผู้ป่วย</Text>
                <Pressable onPress={() => setShowAddModal(false)} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 18, color: DSColors.text.secondary, fontWeight: '600' }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                <PatientFormFields
                  variant="add"
                  values={{
                    firstName: newName,
                    lastName: newLastName,
                    hn: newHn,
                    phone: newPhone,
                    age: newAge,
                    gender: newGender,
                  }}
                  fieldErrors={addFieldErrors}
                  inputStyle={styles.input}
                  selectBoxStyle={styles.selectBox}
                  rowSplitStyle={styles.rowSplit}
                  onChangeFirstName={(v) => {
                    setNewName(v);
                    setAddFieldErrors((e) => clearFieldError(e, 'firstName'));
                  }}
                  onChangeLastName={(v) => {
                    setNewLastName(v);
                    setAddFieldErrors((e) => clearFieldError(e, 'lastName'));
                  }}
                  onChangeHn={(v) => {
                    setNewHn(v);
                    setAddFieldErrors((e) => clearFieldError(e, 'hn'));
                  }}
                  onChangePhone={(v) => {
                    setNewPhone(v);
                    setAddFieldErrors((e) => clearFieldError(e, 'phone'));
                  }}
                  onChangeAge={(v) => {
                    setNewAge(v);
                    setAddFieldErrors((e) => clearFieldError(e, 'age'));
                  }}
                  onOpenGenderPicker={() => setShowAddGenderPicker(true)}
                />

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
              <GenderPickerOverlay
                visible={showAddGenderPicker}
                onClose={() => setShowAddGenderPicker(false)}
                onSelect={(v) => {
                  setNewGender(v);
                  setAddFieldErrors((e) => clearFieldError(e, 'gender'));
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Summary cards — tap to filter list */}
        <View style={[styles.summaryRow, isTablet && styles.summaryRowTablet]}>
          {summaryCards.map((card) => {
            const active =
              (card.key === 'completed' && listFilter === 'completed') ||
              (card.key === 'alerts' && listFilter === 'alerts') ||
              (card.key === 'total' && listFilter === 'all');
            return (
              <Pressable
                key={card.key}
                style={[
                  styles.summaryCard,
                  DSShadowSoft,
                  active && styles.summaryCardActive,
                ]}
                onPress={() => {
                  if (card.key === 'total') setListFilter('all');
                  else if (card.key === 'completed') {
                    setListFilter((f) => (f === 'completed' ? 'all' : 'completed'));
                  } else if (card.key === 'alerts') {
                    setListFilter((f) => (f === 'alerts' ? 'all' : 'alerts'));
                  }
                }}
              >
                <View style={[styles.summaryIconWrap, { backgroundColor: card.bg }]}>
                  <Ionicons name={card.icon} size={28} color={card.color} />
                </View>
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {listFilter !== 'all' && (
          <Pressable onPress={() => setListFilter('all')} style={styles.filterBanner}>
            <Text style={styles.filterBannerText}>
              {listFilter === 'completed'
                ? 'แสดงเฉพาะผู้ป่วยที่ทำครบวันนี้'
                : 'แสดงเฉพาะผู้ป่วยที่มีแจ้งเตือน'}
            </Text>
            <Text style={styles.filterBannerClear}>ล้างตัวกรอง ✕</Text>
          </Pressable>
        )}

        {/* Patient list section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>รายชื่อผู้ป่วย</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => {
                setAddFieldErrors({});
                setShowAddModal(true);
              }}
            >
              <Text style={styles.addButtonText}>+ เพิ่มข้อมูลผู้ป่วย</Text>
            </Pressable>
          </View>

          <View style={[styles.searchWrap, DSShadowSoft]}>
            <Ionicons name="search" size={20} color={DSColors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาชื่อ นามสกุล และรหัสผู้ป่วย"
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
                    <PatientRow item={item} onPatientUpdated={fetchPatients} />
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
                      <PatientRow item={item} onPatientUpdated={fetchPatients} />
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
      {/* Picker for surgery/machine only (gender uses GenderPickerModal inside Add/Edit) */}
      <Modal
        visible={activePicker !== null && activePicker !== 'gender'}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
        presentationStyle="overFullScreen"
        statusBarTranslucent
      >
        <Pressable style={styles.pickerOverlayTop} onPress={closePicker}>
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

function PatientRow({
  item,
  onPatientUpdated,
}: {
  item: Patient;
  onPatientUpdated?: () => void;
}) {
  const statusColor =
    item.status === 'แจ้งเตือน'
      ? DSColors.danger
      : item.status === 'ครบแล้ว'
        ? DSColors.success
        : item.status === 'กำลังรักษา'
          ? DSColors.primary
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
  const [editGenderPickerVisible, setEditGenderPickerVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});

  function prefillEditForm(patient: {
    name?: string;
    hnCode?: string;
    phoneNumber?: string | null;
    age?: number | null;
    gender?: string | null;
  }) {
    const parts = (patient.name || item.name).trim().split(' ');
    setEditName(parts[0] || '');
    setEditLastName(parts.slice(1).join(' ') || '');
    setEditHn(patient.hnCode || item.hnCode || '');
    setEditPhone(patient.phoneNumber || item.phoneNumber || '');
    setEditAge(
      patient.age != null ? String(patient.age) : item.age != null ? String(item.age) : ''
    );
    setEditGender(normalizeGender(patient.gender ?? item.gender));
  }

  const loadPatientForEdit = useCallback(async () => {
    prefillEditForm({
      name: item.name,
      hnCode: item.hnCode,
      phoneNumber: item.phoneNumber,
      age: item.age,
      gender: item.gender,
    });
    if (!authToken) return;
    setEditLoading(true);
    try {
      const res = await getDoctorPatient(authToken, item.id);
      if (res.success && res.data) {
        prefillEditForm(res.data);
      } else if (res.error) {
        console.warn('[PatientRow] load patient:', res.error);
      }
    } catch (err) {
      console.warn('[PatientRow] Could not load patient for edit:', err);
    } finally {
      setEditLoading(false);
    }
  }, [authToken, item]);

  useEffect(() => {
    if (editModalVisible) {
      loadPatientForEdit();
    }
  }, [editModalVisible, loadPatientForEdit]);

  function openEditModal() {
    setEditGenderPickerVisible(false);
    setEditFieldErrors({});
    setEditModalVisible(true);
  }

  async function handleSaveEdit() {
    const dismissEditModal = () => {
      setEditModalVisible(false);
      setEditGenderPickerVisible(false);
    };
    const reopenEditModal = () => setEditModalVisible(true);
    const editAlertOpts: PatientAlertOptions = {
      dismissModal: dismissEditModal,
      onDismiss: reopenEditModal,
    };

    if (!authToken) {
      showPatientAlert('แจ้งเตือน', 'ไม่มีสิทธิ์', editAlertOpts);
      return;
    }
    const emptyErrors = collectPatientFormEmptyErrors({
      firstName: editName,
      lastName: editLastName,
      hn: editHn,
      phone: editPhone,
      age: editAge,
      gender: editGender,
    });
    setEditFieldErrors(emptyErrors);
    if (hasAnyFieldError(emptyErrors)) return;

    const fullName = `${editName.trim()} ${editLastName.trim()}`.trim();
    const thaiOnly = /^[\u0E00-\u0E7F\s]+$/;
    if (!thaiOnly.test(fullName)) {
      showPatientAlert('แจ้งเตือน', 'ชื่อและนามสกุลต้องเป็นตัวอักษรภาษาไทยเท่านั้น', editAlertOpts);
      return;
    }
    if (editPhone.trim().length !== 10) {
      showPatientAlert('แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก', editAlertOpts);
      return;
    }
    const parsedAge = Number(editAge);
    if (Number.isNaN(parsedAge) || parsedAge < 0 || parsedAge >= 130) {
      showPatientAlert('แจ้งเตือน', 'กรุณากรอกอายุเป็นตัวเลขบวก หรือ น้อยกว่าเท่ากับ 130', editAlertOpts);
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
        alertPatientSaveError(res.error, editAlertOpts);
      } else {
        dismissEditModal();
        setEditFieldErrors({});
        showPatientAlert('สำเร็จ', 'บันทึกการแก้ไขเสร็จแล้ว');
        onPatientUpdated?.();
        router.replace(pathname as any);
      }
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Edit error:', err);
      showPatientAlert('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ป่วย', editAlertOpts);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!authToken) {
      showPatientAlert('แจ้งเตือน', 'ไม่มีสิทธิ์');
      return;
    }
    setBusy(true);
    try {
      const res = await deletePatient(authToken, item.id);
      if (!res.success) {
        showPatientAlert('ไม่สามารถลบได้', res.error || 'ไม่สามารถลบผู้ป่วยได้');
      } else {
        // refresh list by emitting a navigation refresh (simpler) — rely on parent page to refetch on focus
        router.replace(pathname as any);
      }
    } catch (err) {
      console.error('[DoctorOverviewDashboard] Delete error:', err);
      showPatientAlert('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบผู้ป่วย');
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
        <Text style={styles.rowProgram}>{item.program} {item.hnCode}</Text>
        {!!item.lastSession && <Text style={styles.rowLast}>{item.lastSession}</Text>}
      </View>
      {/* {!!item.status && (
        <View style={[styles.statusChip, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      )} */}

      {/* Action icons: Edit and Delete */}
      <View style={styles.rowActions}>
        <Pressable
          onPress={(e) => {
            e?.stopPropagation?.();
            openEditModal();
          }}
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
        <Modal
          visible={editModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setEditModalVisible(false);
            setEditGenderPickerVisible(false);
          }}
        >
          <View style={styles.editModalOverlay}>
            <View style={styles.editModalCard}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>แก้ไขข้อมูลผู้ป่วย</Text>
                <Pressable
                  onPress={() => {
                    setEditModalVisible(false);
                    setEditGenderPickerVisible(false);
                  }}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 18, color: DSColors.text.secondary, fontWeight: '600' }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                <PatientFormFields
                  variant="edit"
                  values={{
                    firstName: editName,
                    lastName: editLastName,
                    hn: editHn,
                    phone: editPhone,
                    age: editAge,
                    gender: editGender,
                  }}
                  fieldErrors={editFieldErrors}
                  inputStyle={styles.input}
                  selectBoxStyle={styles.selectBox}
                  rowSplitStyle={styles.rowSplit}
                  genderPickerLoading={editLoading}
                  onChangeFirstName={(v) => {
                    setEditName(v);
                    setEditFieldErrors((e) => clearFieldError(e, 'firstName'));
                  }}
                  onChangeLastName={(v) => {
                    setEditLastName(v);
                    setEditFieldErrors((e) => clearFieldError(e, 'lastName'));
                  }}
                  onChangeHn={(v) => {
                    setEditHn(v);
                    setEditFieldErrors((e) => clearFieldError(e, 'hn'));
                  }}
                  onChangePhone={(v) => {
                    setEditPhone(v);
                    setEditFieldErrors((e) => clearFieldError(e, 'phone'));
                  }}
                  onChangeAge={(v) => {
                    setEditAge(v);
                    setEditFieldErrors((e) => clearFieldError(e, 'age'));
                  }}
                  onOpenGenderPicker={() => setEditGenderPickerVisible(true)}
                />
              </ScrollView>

              <View style={styles.editModalFooter}>
                <Pressable
                  onPress={() => {
                    setEditModalVisible(false);
                    setEditGenderPickerVisible(false);
                  }}
                  style={[styles.editOutlineButton, { flex: 1 }]}
                >
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
              <GenderPickerOverlay
                visible={editGenderPickerVisible}
                onClose={() => setEditGenderPickerVisible(false)}
                onSelect={(v) => {
                  setEditGender(v);
                  setEditFieldErrors((e) => clearFieldError(e, 'gender'));
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal visible={confirmDeleteVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setConfirmDeleteVisible(false)}>
            <View style={[styles.modalCardWrapper, { padding: DSLayout.screenPadding, width: 320 }]}>
              <Text style={{ ...DSTypography.h3, color: DSColors.text.primary, marginBottom: 12 }}>ยืนยันการลบ</Text>
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
  summaryHint: {
    fontSize: 11,
    color: DSColors.text.secondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 4,
  },
  summaryCardActive: {
    borderWidth: 2,
    borderColor: DSColors.primary,
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DSColors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  filterBannerText: {
    fontSize: 14,
    color: DSColors.text.primary,
    flex: 1,
  },
  filterBannerClear: {
    fontSize: 14,
    color: DSColors.primary,
    fontWeight: '600',
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
    position: 'relative',
    overflow: 'hidden',
  },
  genderPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DSLayout.screenPadding,
    zIndex: 1000,
    ...Platform.select({
      android: { elevation: 100 },
      default: {},
    }),
  },
  genderPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    marginTop: 32,
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
  pickerOverlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DSLayout.screenPadding,
    zIndex: 9999,
    ...Platform.select({
      android: { elevation: 24 },
      default: {},
    }),
  },
  pickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.screenPadding,
  },
  pickerCardRaised: {
    zIndex: 2,
    ...Platform.select({
      android: { elevation: 101 },
      default: {},
    }),
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
    justifyContent: "space-between",
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
    marginLeft: 4,
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
