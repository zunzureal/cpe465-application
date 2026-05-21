/**
 * Phone login — uses shared LoginScreenShell so layout matches doctor login exactly.
 */

import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import {
  LoginFieldLabel,
  LoginFootnote,
  LoginHeading,
  LoginHeroPatient,
  LoginPrimaryButton,
  LoginScreenShell,
  LoginTextButton,
  shared,
} from '@/components/screens/LoginScreenShell';
import { DSColors } from '@/constants/design-system';

const MIN_PHONE_DIGITS = 10;
const MOCK_PHONE_BYPASS = '0812345678';

export interface PhoneLoginScreenProps {
  onSuccess?: (phoneNumber: string) => Promise<void>;
}

export function PhoneLoginScreen({ onSuccess }: PhoneLoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const digits = phoneNumber.replace(/\D/g, '');
  const canSubmit = digits.length >= MIN_PHONE_DIGITS;

  const submit = async () => {
    if (!canSubmit) return;
    setErrorMessage('');
    try {
      await onSuccess?.(digits);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ';
      const normalized = String(message).toLowerCase();
      const uiMessage =
        normalized.includes('patient not found') ||
        normalized.includes('contact your healthcare provider') ||
        normalized.includes('404')
          ? 'เบอร์นี้ยังไม่ได้ลงทะเบียน'
          : message;
      setErrorMessage(uiMessage);
    }
  };

  const mockLogin = async () => onSuccess?.(MOCK_PHONE_BYPASS);

  return (
    <LoginScreenShell
      afterCard={
        <LoginFootnote
          th="หากเข้าสู่ระบบไม่ได้ กรุณาติดต่อคลินิกของคุณ"
        />
      }
    >
      <LoginHeroPatient />
      <LoginHeading
        titleTh="ผู้ป่วย"
        titleEn="Patient"
        subtitle="กรอกเบอร์โทรศัพท์ที่ลงทะเบียนกับคลินิก"
      />

      <View style={shared.field}>
        <LoginFieldLabel>เบอร์โทรศัพท์</LoginFieldLabel>
        <TextInput
          style={shared.inputPhone}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="08X XXX XXXX"
          placeholderTextColor={DSColors.text.secondary}
          keyboardType="phone-pad"
          maxLength={14}
          accessibilityLabel="เบอร์โทรศัพท์"
        />
      </View>

      <LoginPrimaryButton label="เข้าสู่ระบบ" disabled={!canSubmit} onPress={submit} />

      {errorMessage ? (
        <Text style={{ marginTop: 12, textAlign: 'center', color: '#B91C1C', fontSize: 14, lineHeight: 20 }}>
          {errorMessage}
        </Text>
      ) : null}

      {/* <LoginTextButton onPress={mockLogin} accessibilityLabel="ทดสอบด้วยเบอร์ตัวอย่าง">
        ทดสอบด้วยเบอร์ 0812345678
      </LoginTextButton> */}
    </LoginScreenShell>
  );
}
