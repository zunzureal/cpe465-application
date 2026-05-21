import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import {
  RequiredFieldLabel,
  withRequiredFieldBorder,
  type FieldErrors,
} from '@/components/ui/RequiredField';
import { DSColors } from '@/constants/design-system';

export type PatientFormFieldValues = {
  firstName: string;
  lastName: string;
  hn: string;
  phone: string;
  age: string;
  gender: string;
};

type PatientFormFieldsProps = {
  values: PatientFormFieldValues;
  fieldErrors: FieldErrors;
  inputStyle: object;
  selectBoxStyle: object;
  rowSplitStyle: object;
  onChangeFirstName: (v: string) => void;
  onChangeLastName: (v: string) => void;
  onChangeHn: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeAge: (v: string) => void;
  onOpenGenderPicker: () => void;
  genderPickerLoading?: boolean;
  /** add modal uses longer English labels */
  variant?: 'add' | 'edit';
};

export function PatientFormFields({
  values,
  fieldErrors,
  inputStyle,
  selectBoxStyle,
  rowSplitStyle,
  onChangeFirstName,
  onChangeLastName,
  onChangeHn,
  onChangePhone,
  onChangeAge,
  onOpenGenderPicker,
  genderPickerLoading,
  variant = 'add',
}: PatientFormFieldsProps) {
  const isAdd = variant === 'add';

  return (
    <>
      <View style={rowSplitStyle}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <RequiredFieldLabel hasError={fieldErrors.firstName}>
            {isAdd ? 'ชื่อ (First Name)' : 'ชื่อ'}
          </RequiredFieldLabel>
          <TextInput
            placeholder="ชื่อจริง"
            placeholderTextColor={DSColors.text.secondary}
            value={values.firstName}
            onChangeText={(text) => {
              onChangeFirstName(text.replace(/[^\u0E00-\u0E7F\s]/g, ''));
            }}
            style={withRequiredFieldBorder(inputStyle, fieldErrors.firstName)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <RequiredFieldLabel hasError={fieldErrors.lastName}>
            {isAdd ? 'นามสกุล (Last Name)' : 'นามสกุล'}
          </RequiredFieldLabel>
          <TextInput
            placeholder="นามสกุล"
            placeholderTextColor={DSColors.text.secondary}
            value={values.lastName}
            onChangeText={(text) => {
              onChangeLastName(text.replace(/[^\u0E00-\u0E7F\s]/g, ''));
            }}
            style={withRequiredFieldBorder(inputStyle, fieldErrors.lastName)}
          />
        </View>
      </View>

      <RequiredFieldLabel hasError={fieldErrors.hn}>
        {isAdd ? 'รหัสผู้ป่วย / HN (Hospital Number)' : 'รหัสผู้ป่วย (HN)'}
      </RequiredFieldLabel>
      <TextInput
        placeholder="HN123456"
        placeholderTextColor={DSColors.text.secondary}
        value={values.hn}
        onChangeText={onChangeHn}
        style={withRequiredFieldBorder(inputStyle, fieldErrors.hn)}
      />

      <RequiredFieldLabel hasError={fieldErrors.phone}>
        {isAdd ? 'เบอร์โทรศัพท์ (Phone Number)' : 'เบอร์โทรศัพท์'}
      </RequiredFieldLabel>
      <TextInput
        placeholder="08XXXXXXXX"
        placeholderTextColor={DSColors.text.secondary}
        value={values.phone}
        onChangeText={(text) => onChangePhone(text.replace(/\D/g, '').slice(0, 10))}
        maxLength={10}
        style={withRequiredFieldBorder(inputStyle, fieldErrors.phone)}
        keyboardType="phone-pad"
      />
      {isAdd ? (
        <Text style={{ fontSize: 12, marginLeft: 4, marginBottom: 10, color: DSColors.text.secondary }}>
          ใช้สำหรับให้ผู้ป่วยเข้าสู่ระบบแอปพลิเคชัน (Used for patient app login)
        </Text>
      ) : null}

      <View style={rowSplitStyle}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <RequiredFieldLabel hasError={fieldErrors.age}>
            {isAdd ? 'อายุ (Age)' : 'อายุ'}
          </RequiredFieldLabel>
          <TextInput
            placeholder="45"
            placeholderTextColor={DSColors.text.secondary}
            value={values.age}
            onChangeText={(text) => onChangeAge(text.replace(/\D/g, ''))}
            keyboardType="numeric"
            style={withRequiredFieldBorder(inputStyle, fieldErrors.age)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <RequiredFieldLabel hasError={fieldErrors.gender}>
            {isAdd ? 'เพศ (Gender)' : 'เพศ (Gender)'}
          </RequiredFieldLabel>
          <Pressable
            style={withRequiredFieldBorder(selectBoxStyle, fieldErrors.gender)}
            onPress={onOpenGenderPicker}
            disabled={genderPickerLoading}
          >
            {genderPickerLoading ? (
              <ActivityIndicator size="small" color={DSColors.primary} />
            ) : (
              <Text style={{ color: values.gender ? DSColors.text.primary : DSColors.text.secondary }}>
                {values.gender || '— เลือกเพศ —'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}
