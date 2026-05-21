/**
 * Doctor login — Email + Password authentication with backend.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import {
  LoginBackRow,
  LoginFieldLabel,
  LoginFootnote,
  LoginHeading,
  LoginHeroDoctor,
  LoginPrimaryButton,
  LoginScreenShell,
  shared,
  DOCTOR_ICON,
} from '@/components/screens/LoginScreenShell';
import { DSColors } from '@/constants/design-system';

const MIN_EMAIL = 5;
const MIN_PASS = 4;

export interface DoctorLoginScreenProps {
  onSuccess?: (email: string, password: string) => Promise<void>;
  onBack?: () => void;
}

export function DoctorLoginScreen({ onSuccess, onBack }: DoctorLoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const valid =
    email.trim().length >= MIN_EMAIL && password.length >= MIN_PASS;

  const handleLogin = async () => {
    if (!valid || isLoading) return;

    setIsLoading(true);
    try {
      await onSuccess?.(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ';
      Alert.alert('เข้าสู่ระบบล้มเหลว', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginScreenShell
      afterCard={
        <>
          <LoginFootnote th="หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบของคลินิก" />
        </>
      }
    >
      <LoginHeroDoctor />
      <LoginHeading
        titleTh="แพทย์ / นักกายภาพ"
        titleEn="Doctor / Physical therapist"
        titleEnStyle={{ color: DOCTOR_ICON }}
        subtitle="กรอกอีเมลและรหัสผ่านที่ได้รับจากคลินิก"
      />

      <View style={shared.field}>
        <LoginFieldLabel>อีเมล</LoginFieldLabel>
        <TextInput
          style={shared.input}
          value={email}
          onChangeText={setEmail}
          placeholder="doctor@hospital.com"
          placeholderTextColor={DSColors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          editable={!isLoading}
          accessibilityLabel="อีเมล"
        />
      </View>

      <View style={shared.field}>
        <LoginFieldLabel>รหัสผ่าน</LoginFieldLabel>
        <View style={shared.passwordWrap}>
          <TextInput
            style={[shared.input, shared.passwordInput]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={DSColors.text.secondary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!isLoading}
            accessibilityLabel="รหัสผ่าน"
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            style={shared.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            disabled={isLoading}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color={DSColors.text.secondary}
            />
          </Pressable>
        </View>
      </View>

      <LoginPrimaryButton
        label={isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        disabled={!valid || isLoading}
        onPress={handleLogin}
      />
    </LoginScreenShell>
  );
}
