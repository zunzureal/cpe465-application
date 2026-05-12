/**
 * Smart Rehab – University Red / Gray Design System
 * Patient-first: large type, high contrast, soft shapes, university-branded palette.
 */

import { Platform } from 'react-native';

// ─── Colors ─────────────────────────────────────────────────────────────
export const DSColors = {
  primary: '#A00000',       // University Red – main CTAs, brand accents
  primaryDark: '#7A0000',   // Pressed/active state
  primaryLight: '#FCE9E9',  // Very light red tint – badges, hover surfaces
  secondary: '#333333',     // Dark Gray – secondary text/headings
  secondaryLight: '#6B7280',// Medium Gray – subtitles
  background: '#F5F5F5',    // Off-white – screen background (SWU-style clean)
  backgroundAlt: '#FAFAFA', // Slightly lighter neutral surface
  surface: '#FFFFFF',       // Cards, sheets, header
  text: {
    primary: '#1F2937',     // Dark Charcoal – headings
    secondary: '#6B7280',   // Medium Gray – subtitles
    inverse: '#FFFFFF',     // On primary/success
  },
  success: '#10B981',       // Soft Green – achievements, progress
  successLight: '#ECFDF5',
  danger: '#EF4444',        // Soft Red – emergency only
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',       // Warning Orange – custom settings, warm-up
  warningLight: '#FEF3C7',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
} as const;

// ─── Typography (Accessible: min 16px body, 24px+ headings) ──────────────
export const DSTypography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  captionBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  small: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  // For numbers/data – bold and clear
  data: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  dataSmall: { fontSize: 16, fontWeight: '700' as const, lineHeight: 22 },
} as const;

// ─── Shapes & shadows ───────────────────────────────────────────────────
export const DSShape = {
  radiusCard: 20,
  radiusButton: 16,
  radiusChip: 12,
  radiusRound: 24,
} as const;

export const DSShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 4 },
  default: {},
}) as { shadowColor?: string; shadowOffset?: { width: number; height: number }; shadowOpacity?: number; shadowRadius?: number } | { elevation?: number };

export const DSShadowSoft = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
}) as { shadowColor?: string; shadowOffset?: { width: number; height: number }; shadowOpacity?: number; shadowRadius?: number } | { elevation?: number };

// ─── Layout ──────────────────────────────────────────────────────────────
export const DSLayout = {
  screenPadding: 20,
  cardPadding: 20,
  sectionGap: 24,
  itemGap: 12,
  iconSize: 24,
  iconSizeLarge: 32,
} as const;
