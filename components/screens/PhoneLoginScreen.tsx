/**
 * Phone login — uses shared LoginScreenShell so layout matches doctor login exactly.
 */

import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

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
  onSuccess?: (phoneNumber: string) => void;
}

export function PhoneLoginScreen({ onSuccess }: PhoneLoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const digits = phoneNumber.replace(/\D/g, '');
  const canSubmit = digits.length >= MIN_PHONE_DIGITS;

  const submit = () => {
    if (!canSubmit) return;
    onSuccess?.(digits);
  };

  const mockLogin = () => onSuccess?.(MOCK_PHONE_BYPASS);

  return (
    <LoginScreenShell
      afterCard={
        <LoginFootnote
          th="หากเข้าสู่ระบบไม่ได้ กรุณาติดต่อคลินิกของคุณ"
          en="If you cannot login, please contact your clinic."
        />
      }
    >
      <LoginHeroPatient />
      <LoginHeading
        titleTh="ผู้ป่วย"
        titleEn="Patient"
        subtitle="กรอกเบอร์โทรศัพท์ที่ลงทะเบียนกับคลินิกเพื่อเริ่มฝึกกายภาพ"
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

      {/* <LoginTextButton onPress={mockLogin} accessibilityLabel="ทดสอบด้วยเบอร์ตัวอย่าง">
        ทดสอบด้วยเบอร์ 0812345678
      </LoginTextButton> */}
    </LoginScreenShell>
  );
}
