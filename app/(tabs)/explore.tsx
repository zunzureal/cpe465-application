/**
 * Settings (ตั้งค่า) – Patient app settings: profile, device, preferences, logout.
 * CPM pairing status ซิงก์กับ DevicePairedContext (เดียวกับ flow สแกนหน้า Home).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DeviceConnectionModal, MOCK_DEVICE_DISPLAY_NAME } from '@/components/ui/DeviceConnectionModal';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicePaired } from '@/contexts/DevicePairedContext';
import {
  DSColors,
  DSLayout,
  DSShape,
  DSTypography,
} from '@/constants/design-system';
import { useMockDeviceConnection } from '@/hooks/useMockDeviceConnection';

// Mock
export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { isPaired, hydrated, clearDevicePaired } = useDevicePaired();
  const patientName = auth.patientName ?? 'ผู้ใช้งาน';
  const patientId = auth.patientId ? `PID-${String(auth.patientId).padStart(4, '0')}` : auth.identifier ?? '—';

  const {
    visible: pairModalVisible,
    status: pairStatus,
    startMockConnection,
    selectDiscoveredDevice,
    dismiss: dismissPairModal,
    canDismiss: pairModalCanDismiss,
  } = useMockDeviceConnection();

  const cpmStatusLine = !hydrated
    ? 'กำลังตรวจสอบสถานะ...'
    : isPaired
      ? `จับคู่แล้ว: ${MOCK_DEVICE_DISPLAY_NAME}`
      : 'ยังไม่ได้จับคู่เครื่อง CPM — แตะเพื่อสแกนหาอุปกรณ์';

  const handleCpmDeviceRow = () => {
    if (!hydrated) return;
    if (isPaired) {
      Alert.alert(
        'ยกเลิกการจับคู่',
        'ต้องการตัดการเชื่อมต่อกับอุปกรณ์หรือไม่? ครั้งถัดไปเมื่อเริ่มเซสชันจะต้องสแกนหาอุปกรณ์ใหม่',
        [
          { text: 'ไม่', style: 'cancel' },
          {
            text: 'ตัดการเชื่อมต่อ',
            style: 'destructive',
            onPress: () => void clearDevicePaired(),
          },
        ]
      );
      return;
    }
    startMockConnection(() => {
      Alert.alert('จับคู่สำเร็จ', `เชื่อมต่อกับ ${MOCK_DEVICE_DISPLAY_NAME} แล้ว`);
    });
  };

  const handleUserGuide = () => {};

  const handleContactSupport = () => {};

  const handleLogout = async () => {
    Alert.alert(
      'ยืนยันการออกจากระบบ',
      'คุณต้องการออกจากระบบใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.logout();
            } catch (err) {
              console.error('[explore] Logout error:', err);
              Alert.alert('ออกจากระบบไม่สำเร็จ', 'กรุณาลองอีกครั้ง');
              return;
            }
            try {
              router.replace('/');
            } catch (navErr) {
              console.warn('[explore] router.replace failed', navErr);
            }
          },
        },
      ],
    );
  };

  const handleManualSetup = () => {
    router.push('/manual-setup');
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: DSColors.primaryLight }]}>
              <Ionicons name="person" size={40} color={DSColors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.patientId}>
                รหัสผู้ป่วย (Patient ID): {patientId}
              </Text>
            </View>
          </View>
        </View>

        {/* CPM / Bluetooth pairing (same state as Home flow) */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleCpmDeviceRow}
            activeOpacity={0.7}
            disabled={!hydrated}
          >
            <Ionicons
              name="bluetooth"
              size={24}
              color={hydrated && isPaired ? DSColors.success : DSColors.primary}
              style={styles.menuIcon}
            />
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>เชื่อมต่อเครื่องกายภาพ (CPM)</Text>
              <View style={styles.statusRow}>
                {hydrated && isPaired ? (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={DSColors.success} style={styles.statusIcon} />
                    <Text style={styles.menuSubPaired} numberOfLines={2}>
                      {cpmStatusLine}
                    </Text>
                  </>
                ) : (
                  <>
                    <View
                      style={[
                        styles.statusDot,
                        !hydrated ? styles.statusDotPending : styles.statusDotOff,
                      ]}
                    />
                    <Text style={styles.menuSub} numberOfLines={2}>
                      {cpmStatusLine}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={DSColors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Manual Session Setup link */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleManualSetup}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color={DSColors.primary} style={styles.menuIcon} />
            <Text style={styles.menuTitle}>ตั้งค่าโหมดฝึกอิสระ (Manual Practice Setup)</Text>
            <Ionicons name="chevron-forward" size={22} color={DSColors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* App Preferences */}
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowBorder]}
            onPress={handleUserGuide}
            activeOpacity={0.7}
          >
            <Ionicons name="book-outline" size={24} color={DSColors.primary} style={styles.menuIcon} />
            <Text style={styles.menuTitle}>คู่มือการใช้งาน (User Guide)</Text>
            <Ionicons name="chevron-forward" size={22} color={DSColors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={DSColors.primary} style={styles.menuIcon} />
            <Text style={styles.menuTitle}>ติดต่อผู้ดูแล (Contact Doctor/Support)</Text>
            <Ionicons name="chevron-forward" size={22} color={DSColors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={24} color={DSColors.danger} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>ออกจากระบบ (Logout)</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <DeviceConnectionModal
        visible={pairModalVisible}
        status={pairStatus}
        onSelectDevice={selectDiscoveredDevice}
        allowDismiss={pairModalCanDismiss}
        onRequestClose={dismissPairModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  content: {
    padding: DSLayout.screenPadding,
    paddingBottom: 40,
  },
  card: {
    borderRadius: DSShape.radiusCard,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DSColors.borderLight,
    backgroundColor: DSColors.surface,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: { flex: 1 },
  patientName: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    marginBottom: 4,
  },
  patientId: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: DSColors.borderLight,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuTextWrap: { flex: 1 },
  menuTitle: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  menuSub: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 4,
    flex: 1,
  },
  menuSubPaired: {
    ...DSTypography.captionBold,
    color: DSColors.success,
    marginTop: 2,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingRight: 8,
  },
  statusIcon: {
    marginTop: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotOff: {
    backgroundColor: DSColors.border,
    borderWidth: 1,
    borderColor: DSColors.text.secondary,
  },
  statusDotPending: {
    backgroundColor: DSColors.warning,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: DSShape.radiusCard,
    borderWidth: 2,
    borderColor: DSColors.danger,
    backgroundColor: DSColors.surface,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '700',
    color: DSColors.danger,
  },
  bottomSpacer: { height: 24 },
});
