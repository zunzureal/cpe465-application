import type { FieldErrors } from '@/components/ui/RequiredField';
import { isEmptyRequiredValue } from '@/components/ui/RequiredField';

export type PatientFormValues = {
  firstName: string;
  lastName: string;
  hn: string;
  phone: string;
  age: string;
  gender: string;
};

/** ตรวจเฉพาะช่องที่ยังไม่กรอก (แสดงกรอบแดง + กรุณากรอกข้อมูล) */
export function collectPatientFormEmptyErrors(values: PatientFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (isEmptyRequiredValue(values.firstName)) errors.firstName = true;
  if (isEmptyRequiredValue(values.lastName)) errors.lastName = true;
  if (isEmptyRequiredValue(values.hn)) errors.hn = true;
  if (isEmptyRequiredValue(values.phone)) errors.phone = true;
  if (isEmptyRequiredValue(values.age)) errors.age = true;
  if (isEmptyRequiredValue(values.gender)) errors.gender = true;
  return errors;
}
