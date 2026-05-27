/**
 * LinkUp design tokens — primary UI theme for Expo screens & shared components.
 */
export const colors = {
  primary: '#6C63FF',
  secondary: '#FF6584',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  text: '#1A1D26',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  /** Tinder-style pass / dismiss control */
  passAction: '#FF5A5F',
  /** Login / signup gradient (dating-app style) */
  authGradientTop: '#2D1B4E',
  authGradientMid: '#6C63FF',
  authGradientBottom: '#FF6584',
  authCard: '#FFFFFF',
  authInputBg: '#F8F9FC',
  /** Discovery / dating-mode surfaces */
  discoveryGradientTop: '#F5F6FA',
  discoveryGradientMid: '#EDE8FF',
  discoveryGradientBottom: '#FFF5F8',
  overlayDark: 'rgba(26, 29, 38, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  /** Pill-shaped buttons and tag chips (app-wide) */
  button: 200,
} as const;

/** Same fill as `Input` `variant="soft"` — use for date/time row triggers and custom controls. */
export const authSoftFieldFill = {
  backgroundColor: colors.authInputBg,
  borderRadius: radius.lg,
  paddingVertical: 14,
  paddingHorizontal: spacing.md,
} as const;

export const fonts = {
  /** Load via @expo-google-fonts/inter or use system fallback */
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;
