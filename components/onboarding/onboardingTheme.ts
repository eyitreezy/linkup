import { colors, radius, spacing } from '@/constants/theme';

/** Onboarding tokens — aligned with Notification Inbox / app gradient shell. */
export const onboarding = {
  accent: colors.primary,
  accentSecondary: colors.secondary,
  accentSoft: 'rgba(108, 99, 255, 0.12)',
  cardBg: 'rgba(255,255,255,0.96)',
  glassBorder: 'rgba(108, 99, 255, 0.18)',
  muted: colors.textMuted,
  text: colors.text,
  radiusXl: radius.xl,
  radius2xl: 20,
  shadow: {
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  spacing,
};
