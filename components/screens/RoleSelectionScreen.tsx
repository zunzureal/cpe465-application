/**
 * RoleSelectionScreen — Smart Rehab entry point.
 * Layout: two equal-width cards always in a row (never stacked).
 */

import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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

const H_PAD = 16;
const MAX_BLOCK = 720;
const CARD_GAP = 12;
const ACCENT_WIDTH = 8;

const DOCTOR_WELL = '#E8EEF5';
const DOCTOR_ICON = '#154565';

export function RoleSelectionScreen({ onSelect }: RoleSelectionScreenProps) {
  const { width } = useWindowDimensions();
  const blockW = Math.min(MAX_BLOCK, width - H_PAD * 2);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.block, { width: blockW }]}>
          <View style={styles.header}>
            <Text style={styles.screenTitle}>กรุณาเลือกสถานะผู้ใช้งาน</Text>
            <Text style={styles.screenSubtitle}>Please select your role</Text>
          </View>

          <View style={styles.cardsRow}>
            <RoleCard
              variant="patient"
              titleTh="ผู้ป่วย"
              titleEn="Patient"
              descriptionTh="เข้าสู่ระบบด้วยเบอร์โทรศัพท์เพื่อเริ่มทำกายภาพ"
              onPress={() => onSelect('patient')}
              accessibilityLabel="เลือกสถานะผู้ป่วย"
            />
            <RoleCard
              variant="doctor"
              titleTh="แพทย์ / นักกายภาพ"
              titleEn="Doctor / Physical Therapist"
              descriptionTh="เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน"
              onPress={() => onSelect('doctor')}
              accessibilityLabel="เลือกสถานะแพทย์หรือนักกายภาพ"
            />
          </View>

          <Text style={styles.helper}>
            คุณสามารถเปลี่ยนสถานะได้ภายหลังโดยการออกจากระบบ
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type RoleCardProps = {
  variant: 'patient' | 'doctor';
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function RoleCard({
  variant,
  titleTh,
  titleEn,
  descriptionTh,
  accessibilityLabel,
  onPress,
}: RoleCardProps) {
  const patient = variant === 'patient';

  return (
    <View style={styles.cardShell}>
      {/*
        Pressable handles touch only (flex:1 to fill shell).
        Layout lives in the inner View so flexDirection:'row' works
        reliably on iOS native without Pressable interference.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={styles.pressable}
      >
        {({ pressed }) => (
          <View style={[styles.card, pressed && styles.cardPressed]}>
            <View
              style={[
                styles.leftAccent,
                patient ? styles.leftAccentPatient : styles.leftAccentDoctor,
              ]}
            />

            <View
              style={[
                styles.iconBox,
                patient ? styles.iconBoxPatient : styles.iconBoxDoctor,
              ]}
            >
              {patient ? (
                <FontAwesome5 name="user-injured" size={24} color={DSColors.primary} />
              ) : (
                <FontAwesome5 name="user-md" size={26} color={DOCTOR_ICON} />
              )}
            </View>

            <View style={styles.textCol}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {titleTh}
              </Text>
              <Text
                style={[styles.cardEn, patient ? styles.cardEnPatient : styles.cardEnDoctor]}
                numberOfLines={1}
              >
                {titleEn}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {descriptionTh}
              </Text>
            </View>

            <View style={styles.chevronBox} pointerEvents="none">
              <Ionicons name="chevron-forward" size={18} color={DSColors.secondaryLight} />
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollInner: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: H_PAD,
    paddingTop: 48,
    paddingBottom: 24,
  },
  block: {
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 128,
  },
  screenTitle: {
    ...DSTypography.h1,
    fontSize: 22,
    color: DSColors.secondary,
    textAlign: 'center',
  },
  screenSubtitle: {
    ...DSTypography.body,
    fontSize: 15,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  /** Always column — cards stack top to bottom. */
  cardsRow: {
    flexDirection: 'column',
    width: '100%',
    gap: CARD_GAP,
  },
  cardShell: {
    flex: 1,
    minWidth: 0,
    borderRadius: DSShape.radiusCard,
    backgroundColor: DSColors.surface,
    ...(DSShadow as object),
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  pressable: {
    flex: 1,
    borderRadius: DSShape.radiusCard,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
    paddingVertical: 12,
    paddingLeft: ACCENT_WIDTH + 8,
    paddingRight: 8,
    borderRadius: DSShape.radiusCard,
    backgroundColor: DSColors.surface,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxPatient: {
    backgroundColor: DSColors.primaryLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(160, 0, 0, 0.15)',
  },
  iconBoxDoctor: {
    backgroundColor: DOCTOR_WELL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21, 69, 101, 0.2)',
  },
  /** flex:1 + minWidth:0 so text never pushes the chevron off screen. */
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cardTitle: {
    ...DSTypography.h3,
    fontSize: 15,
    fontWeight: '700',
    color: DSColors.secondary,
  },
  cardEn: {
    ...DSTypography.captionBold,
    fontSize: 11,
    marginTop: 2,
  },
  cardEnPatient: {
    color: DSColors.primary,
  },
  cardEnDoctor: {
    color: DOCTOR_ICON,
  },
  cardDesc: {
    ...DSTypography.caption,
    fontSize: 11,
    lineHeight: 15,
    color: DSColors.text.secondary,
    marginTop: 4,
  },
  chevronBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  helper: {
    ...DSTypography.caption,
    fontSize: 13,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 4,
  },
  leftAccent: {
    position: 'absolute',
    left: 0.5,
    top: 12,
    bottom: 12,
    width: ACCENT_WIDTH,
    borderTopLeftRadius: DSShape.radiusCard,
    borderBottomLeftRadius: DSShape.radiusCard,
  },
  leftAccentPatient: {
    backgroundColor: DSColors.primary,
  },
  leftAccentDoctor: {
    backgroundColor: DOCTOR_ICON,
  },
});
