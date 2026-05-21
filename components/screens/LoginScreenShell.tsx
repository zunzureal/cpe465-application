/**
 * Shared chrome for patient + doctor login: safe area, keyboard, centered card,
 * and identical typography / controls so both screens always match.
 */

import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSColors, DSShadow, DSShape, DSTypography } from '@/constants/design-system';

const SCREEN_PADDING = 20;
const CARD_MAX_WIDTH = 400;

export const DOCTOR_ICON = '#154565';
const DOCTOR_HERO_BG = '#E8EEF5';
const DOCTOR_HERO_BORDER = 'rgba(21, 69, 101, 0.15)';

type ShellProps = {
  children: ReactNode;
  /** Content below the white card (back link, footnotes). */
  afterCard?: ReactNode;
};

export function LoginScreenShell({ children, afterCard }: ShellProps) {
  const { width } = useWindowDimensions();
  const columnW = Math.min(CARD_MAX_WIDTH, width - SCREEN_PADDING * 2);

  return (
    <SafeAreaView style={shellStyles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={shellStyles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={shellStyles.scroll}
          contentContainerStyle={shellStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[shellStyles.column, { width: columnW }]}>
            <View style={shellStyles.card}>{children}</View>
            {afterCard}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function LoginHeroPatient() {
  return (
    <View style={shared.heroPatient}>
      <FontAwesome5 name="user-injured" size={34} color={DSColors.primary} />
    </View>
  );
}

export function LoginHeroDoctor() {
  return (
    <View style={shared.heroDoctor}>
      <FontAwesome5 name="user-md" size={36} color={DOCTOR_ICON} />
    </View>
  );
}

export function LoginHeading({
  titleTh,
  titleEn,
  subtitle,
  titleEnStyle,
}: {
  titleTh: string;
  titleEn: string;
  subtitle: string;
  titleEnStyle?: TextStyle;
}) {
  return (
    <View style={shared.headingBlock}>
      <Text style={shared.titleTh}>{titleTh}</Text>
      <Text style={[shared.titleEn, titleEnStyle]}>{titleEn}</Text>
      <Text style={shared.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function LoginFieldLabel({
  children,
  required,
  hasError,
}: {
  children: string;
  required?: boolean;
  hasError?: boolean;
}) {
  return (
    <Text style={shared.label}>
      {children}
      {required ? <Text style={{ color: DSColors.danger }}> *</Text> : null}
      {hasError ? (
        <Text style={{ color: DSColors.danger, fontSize: 13, fontWeight: '500' }}>
          {' '}
          กรุณากรอกข้อมูล
        </Text>
      ) : null}
    </Text>
  );
}

export function LoginPrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const inactive = !!disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[shared.primaryBtn, inactive ? shared.primaryBtnOff : shared.primaryBtnOn]}
    >
      <Ionicons
        name="log-in-outline"
        size={21}
        color={inactive ? DSColors.text.secondary : DSColors.text.inverse}
      />
      <Text style={[shared.primaryBtnText, inactive && shared.primaryBtnTextMuted]}>{label}</Text>
    </Pressable>
  );
}

export function LoginTextButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={shared.textBtn}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
    >
      <Text style={shared.textBtnLabel}>{children}</Text>
    </Pressable>
  );
}

export function LoginBackRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={shared.backRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="chevron-back" size={22} color={DSColors.primary} />
      <Text style={shared.backRowLabel}>{label}</Text>
    </Pressable>
  );
}

export function LoginFootnote({ th, en }: { th: string; en?: string }) {
  return (
    <View style={shared.footnoteBlock}>
      <Text style={shared.footnoteTh}>{th}</Text>
      {en ? <Text style={shared.footnoteEn}>{en}</Text> : null}
    </View>
  );
}

/** Shared field + input styles — import and spread or use directly. */
export const shared = StyleSheet.create({
  headingBlock: {
    marginBottom: 24,
  },
  titleTh: {
    ...DSTypography.h1,
    fontSize: 22,
    fontWeight: '700',
    color: DSColors.secondary,
    textAlign: 'center',
  },
  titleEn: {
    ...DSTypography.captionBold,
    fontSize: 14,
    color: DSColors.primary,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    ...DSTypography.body,
    fontSize: 15,
    lineHeight: 22,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
  },
  heroPatient: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: DSColors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(160, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  heroDoctor: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: DOCTOR_HERO_BG,
    borderWidth: 1,
    borderColor: DOCTOR_HERO_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  label: {
    ...DSTypography.captionBold,
    fontSize: 13,
    color: DSColors.secondary,
    marginBottom: 8,
  },
  field: {
    marginBottom: 18,
  },
  inputError: {
    borderColor: DSColors.danger,
    borderWidth: 2,
  },
  inputErrorWrap: {
    borderRadius: DSShape.radiusButton,
    borderWidth: 2,
    borderColor: DSColors.danger,
  },
  input: {
    borderWidth: 2,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '500',
    color: DSColors.text.primary,
    backgroundColor: DSColors.backgroundAlt,
    minHeight: 54,
  },
  inputPhone: {
    borderWidth: 2,
    borderColor: DSColors.border,
    borderRadius: DSShape.radiusButton,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    color: DSColors.text.primary,
    backgroundColor: DSColors.backgroundAlt,
    minHeight: 60,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: DSShape.radiusButton,
    marginTop: 4,
  },
  primaryBtnOn: {
    backgroundColor: DSColors.primary,
  },
  primaryBtnOff: {
    backgroundColor: DSColors.borderLight,
  },
  primaryBtnText: {
    marginLeft: 10,
    fontSize: 17,
    fontWeight: '700',
    color: DSColors.text.inverse,
  },
  primaryBtnTextMuted: {
    color: DSColors.text.secondary,
  },
  textBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textBtnLabel: {
    ...DSTypography.caption,
    fontSize: 14,
    fontWeight: '600',
    color: DSColors.primary,
    textDecorationLine: 'underline',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  backRowLabel: {
    ...DSTypography.bodyBold,
    fontSize: 15,
    color: DSColors.primary,
    marginLeft: 4,
  },
  footnoteBlock: {
    marginTop: 20,
    paddingHorizontal: 4,
  },
  footnoteTh: {
    ...DSTypography.caption,
    fontSize: 13,
    lineHeight: 18,
    color: DSColors.text.secondary,
    textAlign: 'center',
  },
  footnoteEn: {
    fontSize: 12,
    lineHeight: 17,
    color: DSColors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.92,
  },
});

const shellStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DSColors.background,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 20,
  },
  column: {
    alignSelf: 'center',
  },
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSShape.radiusCard,
    borderTopWidth: 5,
    borderTopColor: DSColors.primary,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    ...(DSShadow as object),
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
});
