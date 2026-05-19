/**
 * RoleSelectionScreen — Smart Rehab entry point.
 * Layout: idempotent Flexbox (row of equal-width cards, each card = row: icon | text | chevron).
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
const CARD_MARGIN = 6;
const ICON_BOX = 64;
const CHEVRON_SLOT = 28;
const ACCENT_WIDTH = 8;

const DOCTOR_WELL = '#E8EEF5';
const DOCTOR_ICON = '#154565';

export function RoleSelectionScreen({ onSelect }: RoleSelectionScreenProps) {
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const blockW = isPhone ? width - H_PAD * 2 : Math.min(MAX_BLOCK, width - H_PAD * 2);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, isPhone && styles.scrollInnerPhone]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.block, { width: blockW }]}>
          <View style={[styles.header, isPhone && styles.headerPhone]}>
            <Text style={styles.screenTitle}>กรุณาเลือกสถานะผู้ใช้งาน</Text>
            <Text style={styles.screenSubtitle}>Please select your role</Text>
          </View>

          <View style={[styles.cardsRow, isPhone && styles.cardsRowPhone]}>
            <RoleCard
              isPhone={isPhone}
              variant="patient"
              titleTh="ผู้ป่วย"
              titleEn="Patient"
              descriptionTh="เข้าสู่ระบบด้วยเบอร์โทรศัพท์เพื่อเริ่มทำกายภาพ"
              onPress={() => onSelect('patient')}
              accessibilityLabel="เลือกสถานะผู้ป่วย"
            />
            <RoleCard
              isPhone={isPhone}
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
  isPhone: boolean;
  variant: 'patient' | 'doctor';
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function RoleCard({
  isPhone,
  variant,
  titleTh,
  titleEn,
  descriptionTh,
  accessibilityLabel,
  onPress,
}: RoleCardProps) {
  const patient = variant === 'patient';

  return (
    <View style={[styles.cardShell, isPhone && styles.cardShellPhone]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          isPhone && styles.cardPhone,
          pressed && styles.cardPressed,
        ]}
      >
        <View
          style={[
            styles.leftAccent,
            patient ? styles.leftAccentPatient : styles.leftAccentDoctor,
            isPhone && styles.leftAccentPhone,
          ]}
        />
        <View
          style={[
            styles.iconBox,
            isPhone && styles.iconBoxPhone,
            patient ? styles.iconBoxPatient : styles.iconBoxDoctor,
          ]}
        >
          {patient ? (
            <FontAwesome5 name="user-injured" size={28} color={DSColors.primary} />
          ) : (
            <FontAwesome5 name="user-md" size={30} color={DOCTOR_ICON} />
          )}
        </View>

        <View style={[styles.textCol, isPhone && styles.textColPhone]}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {titleTh}
          </Text>
          <Text
            style={[styles.cardEn, patient ? styles.cardEnPatient : styles.cardEnDoctor]}
            numberOfLines={2}
          >
            {titleEn}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {descriptionTh}
          </Text>
        </View>

        <View style={[styles.chevronBox, isPhone && styles.chevronBoxPhone]} pointerEvents="none">
          <Ionicons name="chevron-forward" size={22} color={DSColors.secondaryLight} />
        </View>
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
    justifyContent: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: 20,
  },
  scrollInnerPhone: {
    justifyContent: 'flex-start',
    paddingTop: 28,
    paddingBottom: 28,
  },
  block: {
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerPhone: {
    marginBottom: 18,
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
  /** Two equal columns; spacing via horizontal margin (no `gap`). */
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  cardsRowPhone: {
    flexDirection: 'column',
  },
  cardShell: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: CARD_MARGIN,
    borderRadius: DSShape.radiusCard,
    backgroundColor: DSColors.surface,
    ...(DSShadow as object),
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  cardShellPhone: {
    flex: 0,
    marginHorizontal: 0,
    marginBottom: 12,
    width: '100%',
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 112,
    paddingVertical: 14,
    paddingHorizontal: 12,
    paddingLeft: ACCENT_WIDTH + 12,
    borderRadius: DSShape.radiusCard,
    backgroundColor: DSColors.surface,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPhone: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    minHeight: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: ACCENT_WIDTH + 16,
  },
  cardPressed: {
    opacity: 0.88,
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBoxPhone: {
    width: 56,
    height: 56,
    marginRight: 0,
    marginTop: 12,
    marginBottom: 12,
    marginLeft: 20,
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
  /** flexShrink + minWidth:0 so long EN titles don’t blow up row width. */
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  textColPhone: {
    width: '100%',
    flex: 0,
  },
  cardTitle: {
    ...DSTypography.h3,
    fontSize: 16,
    fontWeight: '700',
    left: 26,
    color: DSColors.secondary,
  },
  cardEn: {
    ...DSTypography.captionBold,
    fontSize: 12,
    left: 14,
    marginTop: 4,
  },
  cardEnPatient: {
    left: 26,
    color: DSColors.primary,
  },
  cardEnDoctor: {
    left: 26,
    color: DOCTOR_ICON,
  },
  cardDesc: {
    ...DSTypography.caption,
    fontSize: 12,
    lineHeight: 17,
    left: 26,
    color: DSColors.text.secondary,
    marginTop: 6,
  },
  chevronBox: {
    width: CHEVRON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  chevronBoxPhone: {
    width: '100%',
    alignItems: 'flex-end',
    marginLeft: 0,
    marginTop: 10,
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
    top: 18,
    bottom: 24,
    width: ACCENT_WIDTH,
    borderTopLeftRadius: DSShape.radiusCard,
    borderBottomLeftRadius: DSShape.radiusCard,
  },
  leftAccentPhone: {
    top: 4,
    bottom: 4,
  },
  leftAccentPatient: {
    backgroundColor: DSColors.primary,
  },
  leftAccentDoctor: {
    backgroundColor: DOCTOR_ICON,
  },
});
