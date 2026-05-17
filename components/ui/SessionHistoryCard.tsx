import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DSColors, DSLayout, DSShadowSoft, DSShape, DSTypography } from '@/constants/design-system';
import type { SessionWithResult } from '@/services/apiClient';

interface Props {
  session: SessionWithResult;
}

export function SessionHistoryCard({ session }: Props) {
  const dateLabel = new Date(session.sessionDate).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = new Date(session.sessionDate).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const targetFlexion = session.plan?.targetFlexion ?? '—';
  const targetDuration = session.plan?.durationMinutes ?? '—';

  const painColor =
    (session.painLevel ?? 0) >= 7
      ? DSColors.danger
      : (session.painLevel ?? 0) >= 4
        ? DSColors.warning
        : DSColors.success;

  return (
    <View style={[styles.card, DSShadowSoft]}>
      {/* Header row */}
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <View
          style={[
            styles.metChip,
            { backgroundColor: session.targetMet ? DSColors.successLight : DSColors.dangerLight },
          ]}
        >
          <Ionicons
            name={session.targetMet ? 'checkmark-circle' : 'close-circle'}
            size={14}
            color={session.targetMet ? DSColors.success : DSColors.danger}
          />
          <Text style={[styles.metLabel, { color: session.targetMet ? DSColors.success : DSColors.danger }]}>
            {session.targetMet ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุ'}
          </Text>
        </View>
      </View>

      {/* ROM row */}
      <View style={styles.statsRow}>
        <StatCell
          label="เป้า Flexion"
          value={`${targetFlexion}°`}
          sub="Target"
          color={DSColors.text.secondary}
        />
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={16} color={DSColors.text.secondary} />
        </View>
        <StatCell
          label="ทำได้จริง"
          value={`${session.actualMaxFlexion}°`}
          sub="Achieved"
          color={
            session.actualMaxFlexion >= Number(targetFlexion) ? DSColors.success : DSColors.danger
          }
          highlight
        />
        <View style={styles.divider} />
        <StatCell
          label="ระยะเวลา"
          value={`${session.durationCompleted} นาที`}
          sub={`เป้า ${targetDuration} นาที`}
          color={DSColors.text.primary}
        />
        <View style={styles.divider} />
        <StatCell
          label="ความเจ็บปวด"
          value={session.painLevel != null ? String(session.painLevel) : '—'}
          sub="/ 10"
          color={session.painLevel != null ? painColor : DSColors.text.secondary}
          highlight={session.painLevel != null}
        />
      </View>

      {session.isCustomUsed && (
        <View style={styles.customBadge}>
          <Text style={styles.customLabel}>ปรับพารามิเตอร์เอง</Text>
        </View>
      )}
    </View>
  );
}

function StatCell({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellValue, { color }, highlight && styles.cellValueHighlight]}>
        {value}
      </Text>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    padding: DSLayout.cardPadding,
    marginBottom: DSLayout.itemGap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  date: {
    ...DSTypography.bodyBold,
    color: DSColors.text.primary,
  },
  time: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 2,
  },
  metChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DSShape.radiusChip,
  },
  metLabel: {
    ...DSTypography.captionBold,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrow: {
    paddingHorizontal: 2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: DSColors.border,
    marginHorizontal: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  cellValue: {
    ...DSTypography.data,
    color: DSColors.text.primary,
  },
  cellValueHighlight: {
    fontWeight: '700',
  },
  cellLabel: {
    ...DSTypography.captionBold,
    color: DSColors.text.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  cellSub: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  customBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: DSColors.border,
    borderRadius: DSShape.radiusChip,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  customLabel: {
    ...DSTypography.small,
    color: DSColors.text.secondary,
  },
});
