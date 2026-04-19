import { colors, radius, spacing } from '@/constants/theme';

/** Accent: modern green + soft neutrals (Tinder/Hinge/Bumble hybrid) */
export const onboarding = {
  accent: '#16A34A',
  accentSoft: 'rgba(22, 163, 74, 0.12)',
  cardBg: '#FFFFFF',
  muted: colors.textMuted,
  text: colors.text,
  radiusXl: radius.xl,
  radius2xl: 20,
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  spacing,
};
