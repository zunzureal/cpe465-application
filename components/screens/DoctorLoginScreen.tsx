/**
 * Doctor login — Email + Password authentication with backend.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

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
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; password?: boolean }>({});

  const valid =
    email.trim().length >= MIN_EMAIL && password.length >= MIN_PASS;

  const handleLogin = async () => {
    const nextErrors = {
      email: !email.trim(),
      password: !password.trim(),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    if (!valid || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      await onSuccess?.(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ';
      const normalized = String(message).toLowerCase();
      const uiMessage =
        normalized.includes('invalid email or password') || normalized.includes('401')
          ? 'อีเมลหรือรหัสผ่านผิด'
          : message;
      setErrorMessage(uiMessage);
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
        <LoginFieldLabel required hasError={fieldErrors.email}>
          อีเมล
        </LoginFieldLabel>
        <TextInput
          style={[shared.input, fieldErrors.email && shared.inputError]}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: false }));
          }}
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
        <LoginFieldLabel required hasError={fieldErrors.password}>
          รหัสผ่าน
        </LoginFieldLabel>
        <View style={[shared.passwordWrap, fieldErrors.password && shared.inputErrorWrap]}>
          <TextInput
            style={[shared.input, shared.passwordInput, fieldErrors.password && shared.inputError]}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: false }));
            }}
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

      {errorMessage ? (
        <Text style={{ marginTop: 12, textAlign: 'center', color: '#B91C1C', fontSize: 14, lineHeight: 20 }}>
          {errorMessage}
        </Text>
      ) : null}
    </LoginScreenShell>
  );
}
