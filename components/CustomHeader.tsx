/**
 * Smart Rehab — global app header.
 * Styled after the SWU website: white background, university logo + name on the
 * left, red accent border at the bottom, user badge on the right.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSColors, DSShape } from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';

const SWU_LOGO = require('@/assets/images/Srinakharinwirot_Logo_TH_Color (2).png');

export interface CustomHeaderProps {
  /** Show a back chevron instead of the logo + name block. */
  showBack?: boolean;
  /** Optional subtitle below the university name (defaults to "Smart Rehab"). */
  appName?: string;
  /** Replace the default right user-badge with a custom element. */
  rightSlot?: ReactNode;
  /** Override the back action — passed from Stack header fn so it uses screen-level navigation. */
  onBack?: () => void;
}

export function CustomHeader({
  showBack = false,
  appName = 'Smart Rehab',
  rightSlot,
  onBack,
}: CustomHeaderProps) {
  const auth = useAuth();

  const handleBack = onBack ?? (() => router.back());

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>

        {/* ── Left: back + logo (showBack) OR logo only ── */}
        <View style={styles.brandBlock}>
          {showBack && (
            <Pressable
              hitSlop={10}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="ย้อนกลับ"
              style={({ pressed }) => [styles.backIconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={26} color={DSColors.primary} />
            </Pressable>
          )}
          <View style={styles.logoBadge} accessibilityLabel="โลโก้มหาวิทยาลัยศรีนครินทรวิโรฒ">
            <Image source={SWU_LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>
          <View style={styles.brandText}>
            <Text numberOfLines={1} style={styles.uniNameTh}>มหาวิทยาลัยศรีนครินทรวิโรฒ</Text>
            <Text numberOfLines={1} style={styles.uniNameEn}>SRINAKHARINWIROT UNIVERSITY</Text>
            <Text numberOfLines={1} style={styles.appNameText}>{appName}</Text>
          </View>
        </View>

        {/* ── Right: user badge or custom slot ── */}
        <View style={styles.rightZone}>
          {rightSlot !== undefined ? (
            rightSlot
          ) : auth.isLoggedIn ? (
            <UserBadge identifier={auth.identifier} role={auth.role} />
          ) : null}
        </View>
      </View>

      {/* Red accent line at the bottom of the header */}
      <View style={styles.accentBar} />
    </SafeAreaView>
  );
}

// ─── Internal user badge ──────────────────────────────────────────────────────

interface UserBadgeProps {
  identifier: string | null;
  role: 'patient' | 'doctor' | null;
}

function UserBadge({ identifier, role }: UserBadgeProps) {
  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    role === 'doctor' ? 'medkit' : 'person-circle';

  const displayName = (() => {
    if (role === 'patient') return 'ผู้ป่วย';
    if (!identifier) return 'แพทย์';
    return identifier.length > 12 ? `${identifier.slice(0, 12)}…` : identifier;
  })();

  return (
    <View style={styles.userBadge}>
      <View style={styles.userIconWrap}>
        <Ionicons name={iconName} size={20} color={DSColors.primary} />
      </View>
      <Text numberOfLines={1} style={styles.userBadgeText}>
        {displayName}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const HEADER_HEIGHT = 64;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DSColors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },

  // Back icon button (sits to the left of the logo)
  backIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primaryLight,
    marginRight: 4,
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.6,
  },

  // Brand block (logo + name)
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: DSShape.radiusRound,
    backgroundColor: DSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DSColors.border,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  brandText: {
    flex: 1,
    justifyContent: 'center',
  },
  uniNameTh: {
    fontSize: 13,
    fontWeight: '700',
    color: DSColors.secondary,
    letterSpacing: 0.1,
  },
  uniNameEn: {
    fontSize: 9,
    fontWeight: '500',
    color: DSColors.secondaryLight,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  appNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: DSColors.primary,
    marginTop: 3,
    letterSpacing: 0.3,
  },

  // Red bottom accent line
  accentBar: {
    height: 3,
    backgroundColor: DSColors.primary,
  },

  // Right zone
  rightZone: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DSColors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DSShape.radiusChip,
    maxWidth: 130,
  },
  userIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: DSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: DSColors.primary,
    flexShrink: 1,
  },
});
