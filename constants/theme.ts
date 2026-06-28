/**
 * LinkUp design tokens — primary UI theme for Expo screens & shared components.
 */
export const colors = {
  primary: '#5E52FF',
  secondary: '#FF4A72',
  background: '#EEF1FA',
  surface: '#FFFFFF',
  text: '#1A1D26',
  textMuted: '#5B6577',
  border: '#D8DCE6',
  success: '#0EA872',
  warning: '#E89008',
  danger: '#E83838',
  /** Tinder-style pass / dismiss control */
  passAction: '#FF4757',
  /** Login / signup gradient (dating-app style) */
  authGradientTop: '#2D1B4E',
  authGradientMid: '#5E52FF',
  authGradientBottom: '#FF4A72',
  authCard: '#FFFFFF',
  authInputBg: '#F5F7FC',
  /** Discovery / dating-mode surfaces */
  discoveryGradientTop: '#EEF1FA',
  discoveryGradientMid: '#D2C9FF',
  discoveryGradientBottom: '#FFD6E8',
  /** 4-stop shell gradient (lavender → rose → mint → blush) */
  discoveryShellLavender: '#D2C9FF',
  discoveryShellRose: '#FFD1E3',
  discoveryShellMint: '#B8EDD9',
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

/** Plus Jakarta Sans — loaded in `app/_layout.tsx` via @expo-google-fonts/plus-jakarta-sans */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_800ExtraBold',
} as const;
