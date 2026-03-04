/**
 * Settings (ตั้งค่า) – Patient app settings: profile, device, preferences, logout.
 * Grouped list style (iOS/Android).
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';

const TEAL = '#0B8FAC';

// Mock
const MOCK_PATIENT_NAME = 'คุณสมชาย ใจดี';
const MOCK_PATIENT_ID = 'PID-2401';
const MOCK_DEVICE_CONNECTED = false;

export default function SettingsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0D1117' : '#F0F4F8';
  const cardBg = isDark ? '#1C2128' : '#FFFFFF';
  const textPrimary = isDark ? '#E8EDF2' : '#1A2B3C';
  const textSecondary = isDark ? '#8FA0B0' : '#6B7280';
  const borderColor = isDark ? '#2D3945' : '#E5E7EB';
  const primaryColor = isDark ? '#1DD4B3' : TEAL;

  const handleConnectDevice = () => {
    // Placeholder: open device pairing
  };

  const handleUserGuide = () => {
    // Placeholder: open guide
  };

  const handleContactSupport = () => {
    // Placeholder: open contact
  };

  const handleLogout = () => {
    router.replace('/(tabs)');
  };

  const handleManualSetup = () => {
    router.push('/manual-setup');
  };

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#0C2535' : TEAL }]}>
        <Text style={styles.headerTitle}>ตั้งค่า</Text>
        <Text style={styles.headerSubtitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: primaryColor + '25' }]}>
              <Ionicons name="person" size={40} color={primaryColor} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.patientName, { color: textPrimary }]}>{MOCK_PATIENT_NAME}</Text>
              <Text style={[styles.patientId, { color: textSecondary }]}>
                รหัสผู้ป่วย (Patient ID): {MOCK_PATIENT_ID}
              </Text>
            </View>
          </View>
        </View>

        {/* Device Connection */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleConnectDevice}
            activeOpacity={0.7}
          >
            <Ionicons name="bluetooth" size={24} color={primaryColor} style={styles.menuIcon} />
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: textPrimary }]}>
                เชื่อมต่อเครื่องกายภาพ (Connect Device)
              </Text>
              <Text style={[styles.menuSub, { color: textSecondary }]}>
                {MOCK_DEVICE_CONNECTED ? '🟢 เชื่อมต่อแล้ว' : '🔴 ยังไม่เชื่อมต่อ'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Manual Session Setup link */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleManualSetup}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color={primaryColor} style={styles.menuIcon} />
            <Text style={[styles.menuTitle, { color: textPrimary }]}>
              ตั้งค่าโหมดฝึกอิสระ (Manual Practice Setup)
            </Text>
            <Ionicons name="chevron-forward" size={22} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* App Preferences */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowBorder, { borderBottomColor: borderColor }]}
            onPress={handleUserGuide}
            activeOpacity={0.7}
          >
            <Ionicons name="book-outline" size={24} color={primaryColor} style={styles.menuIcon} />
            <Text style={[styles.menuTitle, { color: textPrimary }]}>
              คู่มือการใช้งาน (User Guide)
            </Text>
            <Ionicons name="chevron-forward" size={22} color={textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={primaryColor} style={styles.menuIcon} />
            <Text style={[styles.menuTitle, { color: textPrimary }]}>
              ติดต่อผู้ดูแล (Contact Doctor/Support)
            </Text>
            <Ionicons name="chevron-forward" size={22} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={24} color="#EF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>ออกจากระบบ (Logout)</Text>
        </TouchableOpacity>

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
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  patientId: {
    fontSize: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuTextWrap: { flex: 1 },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuSub: {
    fontSize: 13,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EF4444',
  },
  bottomSpacer: { height: 24 },
});
