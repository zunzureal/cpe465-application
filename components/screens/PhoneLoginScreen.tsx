/**
 * Phone-Only Login Screen – Elderly-friendly, no password, no OTP.
 * Backend validates that the phone number is a registered patient.
 */

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSColors, DSTypography, DSShape } from '@/constants/design-system';

const MIN_PHONE_DIGITS = 10;
const PRIMARY = DSColors.success; // Medical green

/** Mock number to bypass login during development. */
const MOCK_PHONE_BYPASS = '0812345678';

export interface PhoneLoginScreenProps {
  /** Called after successful validation (e.g. navigate to app). */
  onSuccess?: (phoneNumber: string) => void;
}

export function PhoneLoginScreen({ onSuccess }: PhoneLoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');

  const digitsOnly = phoneNumber.replace(/\D/g, '');
  const isValid = digitsOnly.length >= MIN_PHONE_DIGITS;

  const handleLogin = () => {
    if (!isValid) return;
    const cleaned = digitsOnly;
    // Mock: in production, POST to backend; backend checks if phone is registered.
    console.log('Logging in with: ', cleaned);
    Alert.alert(
      'เข้าสู่ระบบ',
      `เบอร์โทรศัพท์: ${cleaned}\n\n(ในระบบจริง เซิร์ฟเวอร์จะตรวจสอบว่าลงทะเบียนกับคลินิกแล้ว)`,
      [
        {
          text: 'ตกลง',
          onPress: () => onSuccess?.(cleaned),
        },
      ]
    );
  };

  /** Bypass: login with mock number (no alert, go straight to app). */
  const handleMockBypass = () => {
    console.log('Logging in with mock: ', MOCK_PHONE_BYPASS);
    onSuccess?.(MOCK_PHONE_BYPASS);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <View style={styles.content}>
          {/* Header */}
          <Text style={styles.title}>เข้าสู่ระบบเพื่อเริ่มทำกายภาพ</Text>
          <Text style={styles.subtitle}>
            กรอกเบอร์โทรศัพท์ที่คุณได้ลงทะเบียนไว้กับคุณหมอ
          </Text>

          {/* Input */}
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="08X-XXX-XXXX"
            placeholderTextColor={DSColors.text.secondary}
            keyboardType="phone-pad"
            maxLength={14}
            accessibilityLabel="เบอร์โทรศัพท์"
            accessibilityHint="กรอกเบอร์โทรศัพท์ที่ลงทะเบียนกับคลินิก"
          />

          {/* Login Button */}
          <Pressable
            style={[
              styles.button,
              isValid ? styles.buttonActive : styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={!isValid}
            accessibilityRole="button"
            accessibilityLabel="เข้าสู่ระบบ"
          >
            <Text style={styles.buttonText}>เข้าสู่ระบบ (Login)</Text>
          </Pressable>

          {/* Mock bypass – tap to login with 0812345678 without typing */}
          <Pressable
            style={styles.mockBypass}
            onPress={handleMockBypass}
            accessibilityLabel="ใช้เบอร์ทดสอบ"
          >
            <Text style={styles.mockBypassText}>ใช้เบอร์ทดสอบ (Mock: 0812345678)</Text>
          </Pressable>
        </View>

        {/* Footer help text */}
        <Text style={styles.footer}>
          หากเข้าสู่ระบบไม่ได้ กรุณาติดต่อคลินิกของคุณ
        </Text>
        <Text style={styles.footerEn}>
          If you cannot login, please contact your clinic.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.surface,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  content: {
    flex: 1,
  },
  title: {
    ...DSTypography.h1,
    fontSize: 28,
    color: DSColors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    ...DSTypography.body,
    fontSize: 18,
    lineHeight: 26,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  input: {
    borderWidth: 3,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 20,
    paddingHorizontal: 24,
    fontSize: 24,
    fontWeight: '600',
    color: DSColors.text.primary,
    backgroundColor: DSColors.background,
    marginBottom: 28,
    minHeight: 72,
  },
  button: {
    width: '100%',
    paddingVertical: 20,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: PRIMARY,
  },
  buttonDisabled: {
    backgroundColor: DSColors.border,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: DSColors.text.inverse,
  },
  mockBypass: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mockBypassText: {
    fontSize: 15,
    fontWeight: '600',
    color: DSColors.text.secondary,
    textDecorationLine: 'underline',
  },
  footer: {
    ...DSTypography.caption,
    fontSize: 15,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 24,
  },
  footerEn: {
    fontSize: 13,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
});
