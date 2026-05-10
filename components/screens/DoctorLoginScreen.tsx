/**
 * Doctor login — same shell / spacing / card as patient login.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  LoginBackRow,
  LoginFieldLabel,
  LoginFootnote,
  LoginHeading,
  LoginHeroDoctor,
  LoginPrimaryButton,
  LoginScreenShell,
  shared,
} from '@/components/screens/LoginScreenShell';
import { DSColors } from '@/constants/design-system';

const MIN_USER = 3;
const MIN_PASS = 4;

export interface DoctorLoginScreenProps {
  onSuccess?: (username: string) => void;
  onBack?: () => void;
}

export function DoctorLoginScreen({ onSuccess, onBack }: DoctorLoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const valid =
    username.trim().length >= MIN_USER && password.length >= MIN_PASS;

  return (
    <LoginScreenShell
      afterCard={
        <>
          {onBack ? (
            <LoginBackRow label="กลับไปเลือกสถานะ" onPress={onBack} />
          ) : null}
          <LoginFootnote th="หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบของคลินิก" />
        </>
      }
    >
      <LoginHeroDoctor />
      <LoginHeading
        titleTh="แพทย์ / นักกายภาพ"
        titleEn="Doctor / Physical therapist"
        subtitle="กรอกชื่อผู้ใช้และรหัสผ่านที่คลินิกออกให้"
      />

      <View style={shared.field}>
        <LoginFieldLabel>ชื่อผู้ใช้</LoginFieldLabel>
        <TextInput
          style={shared.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={DSColors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          accessibilityLabel="ชื่อผู้ใช้"
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
            accessibilityLabel="รหัสผ่าน"
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            style={shared.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
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
        label="เข้าสู่ระบบ"
        disabled={!valid}
        onPress={() => valid && onSuccess?.(username.trim())}
      />
    </LoginScreenShell>
  );
}
