/**
 * DoctorLoginScreen — Username + Password mock login for the doctor /
 * physical therapist role. Backend integration is intentionally stubbed:
 * any non-empty pair currently passes validation.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSColors, DSShape, DSTypography } from '@/constants/design-system';

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 4;

export interface DoctorLoginScreenProps {
  /** Called once mock validation passes. */
  onSuccess?: (username: string) => void;
  /** Optional back handler (defaults to no-op when omitted). */
  onBack?: () => void;
}

export function DoctorLoginScreen({ onSuccess, onBack }: DoctorLoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValid =
    username.trim().length >= MIN_USERNAME_LENGTH &&
    password.length >= MIN_PASSWORD_LENGTH;

  const handleLogin = () => {
    if (!isValid) return;
    onSuccess?.(username.trim());
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconBadge}>
            <Ionicons name="medkit" size={36} color={DSColors.primary} />
          </View>

          <Text style={styles.title}>เข้าสู่ระบบสำหรับแพทย์</Text>
          <Text style={styles.subtitle}>
            กรอกชื่อผู้ใช้และรหัสผ่านที่คลินิกออกให้
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>ชื่อผู้ใช้ (Username)</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={DSColors.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              accessibilityLabel="ชื่อผู้ใช้"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>รหัสผ่าน (Password)</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={DSColors.text.secondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                accessibilityLabel="รหัสผ่าน"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={DSColors.text.secondary}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              isValid ? styles.primaryButtonActive : styles.primaryButtonDisabled,
            ]}
            disabled={!isValid}
            onPress={handleLogin}
            accessibilityRole="button"
            accessibilityLabel="เข้าสู่ระบบ"
          >
            <Text style={styles.primaryButtonText}>เข้าสู่ระบบ (Login)</Text>
          </Pressable>

          {onBack ? (
            <Pressable
              onPress={onBack}
              style={styles.backLink}
              accessibilityRole="button"
              accessibilityLabel="ย้อนกลับไปหน้าเลือกสถานะ"
            >
              <Ionicons name="chevron-back" size={18} color={DSColors.secondary} />
              <Text style={styles.backLinkText}>ย้อนกลับ</Text>
            </Pressable>
          ) : null}

          <Text style={styles.helper}>
            หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบของคลินิก
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  iconBadge: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    ...DSTypography.h1,
    fontSize: 26,
    color: DSColors.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    ...DSTypography.captionBold,
    color: DSColors.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '500',
    color: DSColors.text.primary,
    backgroundColor: DSColors.surface,
    minHeight: 56,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: 8,
    width: '100%',
    paddingVertical: 18,
    borderRadius: DSShape.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonActive: {
    backgroundColor: DSColors.primary,
  },
  primaryButtonDisabled: {
    backgroundColor: DSColors.border,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: DSColors.text.inverse,
  },
  backLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backLinkText: {
    ...DSTypography.bodyBold,
    color: DSColors.secondary,
  },
  helper: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 28,
  },
});
