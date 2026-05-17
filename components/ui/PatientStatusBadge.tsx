import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DSColors, DSShape, DSTypography } from '@/constants/design-system';
import type { PatientTodayStatus } from '@/services/apiClient';

const STATUS_CONFIG: Record<
  PatientTodayStatus,
  { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  normal: {
    label: 'ปกติ',
    color: DSColors.success,
    bg: DSColors.successLight,
    icon: 'checkmark-circle',
  },
  alert_pain: {
    label: 'แจ้งเตือน: ปวดมาก',
    color: DSColors.danger,
    bg: DSColors.dangerLight,
    icon: 'warning',
  },
  in_session: {
    label: 'กำลังรักษา',
    color: DSColors.primary,
    bg: DSColors.primaryLight,
    icon: 'pulse',
  },
  no_session: {
    label: 'ยังไม่ทำวันนี้',
    color: DSColors.text.secondary,
    bg: DSColors.border,
    icon: 'time-outline',
  },
};

interface Props {
  status: PatientTodayStatus;
  compact?: boolean;
}

export function PatientStatusBadge({ status, compact = false }: Props) {
  const cfg = STATUS_CONFIG[status];

  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }, compact && styles.chipCompact]}>
      <Ionicons name={cfg.icon} size={compact ? 12 : 14} color={cfg.color} />
      {!compact && (
        <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DSShape.radiusChip,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  label: {
    ...DSTypography.captionBold,
  },
});
