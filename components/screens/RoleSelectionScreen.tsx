/**
 * RoleSelectionScreen — Smart Rehab entry point.
 * Asks the user to identify themselves as a Patient or Doctor/Therapist
 * before continuing to the appropriate login flow.
 */

import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DSColors,
  DSShadow,
  DSShape,
  DSTypography,
} from '@/constants/design-system';

export type SelectableRole = 'patient' | 'doctor';

export interface RoleSelectionScreenProps {
  onSelect: (role: SelectableRole) => void;
}

export function RoleSelectionScreen({ onSelect }: RoleSelectionScreenProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>กรุณาเลือกสถานะผู้ใช้งาน</Text>
          <Text style={styles.subtitle}>Please select your role</Text>
        </View>

        <View style={styles.cards}>
          <RoleCard
            emoji="🧑‍🦳"
            iconName="person-circle"
            titleTh="ผู้ป่วย"
            titleEn="Patient"
            descriptionTh="เข้าสู่ระบบด้วยเบอร์โทรศัพท์เพื่อเริ่มทำกายภาพ"
            onPress={() => onSelect('patient')}
            accessibilityLabel="เลือกสถานะผู้ป่วย"
          />

          <RoleCard
            emoji="👨‍⚕️"
            iconName="medkit"
            titleTh="แพทย์ / นักกายภาพ"
            titleEn="Doctor / Physical Therapist"
            descriptionTh="เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน"
            onPress={() => onSelect('doctor')}
            accessibilityLabel="เลือกสถานะแพทย์หรือนักกายภาพ"
          />
        </View>

        <Text style={styles.helperText}>
          คุณสามารถเปลี่ยนสถานะได้ภายหลังโดยการออกจากระบบ
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface RoleCardProps {
  emoji: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function RoleCard({
  emoji,
  iconName,
  titleTh,
  titleEn,
  descriptionTh,
  accessibilityLabel,
  onPress,
}: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardIconWrap}>
        <Ionicons name={iconName} size={36} color={DSColors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <Text style={styles.cardTitle}>{titleTh}</Text>
        <Text style={styles.cardSubtitle}>{titleEn}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {descriptionTh}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={24}
        color={DSColors.secondaryLight}
        style={styles.cardChevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    ...DSTypography.h1,
    fontSize: 26,
    color: DSColors.secondary,
    textAlign: 'center',
  },
  subtitle: {
    ...DSTypography.body,
    color: DSColors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  cards: {
    gap: 20,
    marginBottom: 24,
  },
  card: {
    minHeight: 140,
    borderRadius: DSShape.radiusCard,
    backgroundColor: DSColors.surface,
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingLeft: 28,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...(DSShadow as object),
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: DSColors.primary,
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DSColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardBody: {
    flex: 1,
  },
  cardEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  cardTitle: {
    ...DSTypography.h3,
    fontSize: 20,
    color: DSColors.secondary,
  },
  cardSubtitle: {
    ...DSTypography.captionBold,
    color: DSColors.primary,
    marginTop: 2,
  },
  cardDescription: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    marginTop: 6,
  },
  cardChevron: {
    marginLeft: 8,
  },
  helperText: {
    ...DSTypography.caption,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 16,
  },
});
