import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { DSColors, DSTypography } from '@/constants/design-system';

/** ข้อความมาตรฐานหลังเครื่องหมาย * เมื่อยังไม่กรอก */
export const REQUIRED_FIELD_MESSAGE = 'กรุณากรอกข้อมูล';

export type FieldErrors = Record<string, boolean>;

export function isEmptyRequiredValue(value: string | null | undefined): boolean {
  return !String(value ?? '').trim();
}

export function hasAnyFieldError(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function clearFieldError(
  errors: FieldErrors,
  field: string
): FieldErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

type RequiredFieldLabelProps = {
  children: React.ReactNode;
  hasError?: boolean;
  style?: StyleProp<TextStyle>;
};

export function RequiredFieldLabel({ children, hasError, style }: RequiredFieldLabelProps) {
  return (
    <Text style={[styles.label, style]}>
      {children}
      <Text style={styles.asterisk}> *</Text>
      {hasError ? <Text style={styles.errorAfterAsterisk}> {REQUIRED_FIELD_MESSAGE}</Text> : null}
    </Text>
  );
}

export function withRequiredFieldBorder<T extends object>(
  base: T,
  hasError?: boolean
): (T | ViewStyle | TextStyle)[] {
  return [base, hasError ? styles.inputError : null].filter(Boolean) as (T | ViewStyle | TextStyle)[];
}

const styles = StyleSheet.create({
  label: {
    ...DSTypography.bodyBold,
    fontSize: 16,
    marginBottom: 6,
    color: DSColors.text.primary,
  },
  asterisk: {
    color: DSColors.danger,
  },
  errorAfterAsterisk: {
    color: DSColors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  inputError: {
    borderColor: DSColors.danger,
    borderWidth: 2,
  },
});
