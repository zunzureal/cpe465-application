/**
 * Mock Bluetooth / IoT pairing UI — state machine driven by `useMockDeviceConnection`.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  DSColors,
  DSLayout,
  DSShape,
  DSTypography,
} from '@/constants/design-system';

import type { DeviceConnectionStatus } from '@/hooks/useMockDeviceConnection';

export const MOCK_DEVICE_DISPLAY_NAME = 'Smart-CPM-X1';

export interface DeviceConnectionModalProps {
  visible: boolean;
  status: DeviceConnectionStatus;
  onSelectDevice: () => void;
  /** When true, backdrop / hardware back may call `onRequestClose`. */
  allowDismiss?: boolean;
  onRequestClose?: () => void;
}

export function DeviceConnectionModal({
  visible,
  status,
  onSelectDevice,
  allowDismiss = true,
  onRequestClose,
}: DeviceConnectionModalProps) {
  const dismissViaBackdrop = allowDismiss ? onRequestClose : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissViaBackdrop}
    >
      <Pressable
        style={styles.backdrop}
        onPress={dismissViaBackdrop}
        accessible={false}
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {status === 'scanning' && (
            <>
              <ActivityIndicator size="large" color={DSColors.primary} />
              <Text style={styles.title}>กำลังสแกนหาอุปกรณ์...</Text>
              <Text style={styles.subtitle}>Scanning for devices...</Text>
            </>
          )}

          {status === 'found' && (
            <>
              <Text style={styles.title}>พบอุปกรณ์: กรุณากดเพื่อเชื่อมต่อ</Text>
              <Text style={styles.subtitle}>Device found: Tap to connect</Text>
              <TouchableOpacity
                style={styles.deviceCard}
                onPress={onSelectDevice}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`เชื่อมต่อ ${MOCK_DEVICE_DISPLAY_NAME}`}
              >
                <View style={styles.deviceIconWrap}>
                  <Ionicons name="bluetooth" size={28} color={DSColors.primary} />
                </View>
                <View style={styles.deviceTextCol}>
                  <Text style={styles.deviceName}>{MOCK_DEVICE_DISPLAY_NAME}</Text>
                  <Text style={styles.deviceHint}>แตะเพื่อจับคู่ Bluetooth</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={DSColors.text.secondary} />
              </TouchableOpacity>
            </>
          )}

          {status === 'connecting' && (
            <>
              <ActivityIndicator size="large" color={DSColors.primary} />
              <Text style={styles.title}>กำลังเชื่อมต่อ...</Text>
              <Text style={styles.subtitle}>Connecting...</Text>
            </>
          )}

          {status === 'success' && (
            <>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={72} color={DSColors.success} />
              </View>
              <Text style={styles.titleSuccess}>เชื่อมต่อสำเร็จ!</Text>
              <Text style={styles.subtitle}>Connected successfully</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: DSLayout.screenPadding,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DSColors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  title: {
    ...DSTypography.h3,
    color: DSColors.text.primary,
    textAlign: 'center',
    marginTop: 20,
  },
  titleSuccess: {
    ...DSTypography.h3,
    color: DSColors.secondary,
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  successIconWrap: {
    marginTop: 4,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: DSColors.primaryLight,
    borderRadius: DSShape.radiusButton,
    borderWidth: 1.5,
    borderColor: DSColors.primary,
    gap: 14,
  },
  deviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceTextCol: {
    flex: 1,
  },
  deviceName: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  deviceHint: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    marginTop: 4,
  },
});
