import type { FieldErrors } from '@/components/ui/RequiredField';
import { isEmptyRequiredValue } from '@/components/ui/RequiredField';

export type PlanFormValues = {
  planStart: string;
  planEnd: string;
  sessionsPerDay: string;
  daysOfWeek: boolean[];
  targetFlexion: string;
  targetExtension: string;
  speedLevel: string;
  durationMinutes: string;
  targetForceN: string;
};

export function collectPlanFormEmptyErrors(values: PlanFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (isEmptyRequiredValue(values.planStart) || isEmptyRequiredValue(values.planEnd)) {
    errors.planRange = true;
  }
  if (isEmptyRequiredValue(values.sessionsPerDay)) errors.sessionsPerDay = true;
  if (!values.daysOfWeek.some(Boolean)) errors.daysOfWeek = true;
  if (isEmptyRequiredValue(values.targetFlexion)) errors.targetFlexion = true;
  if (isEmptyRequiredValue(values.targetExtension)) errors.targetExtension = true;
  if (isEmptyRequiredValue(values.speedLevel)) errors.speedLevel = true;
  if (isEmptyRequiredValue(values.durationMinutes)) errors.durationMinutes = true;
  if (isEmptyRequiredValue(values.targetForceN)) errors.targetForceN = true;
  return errors;
}
