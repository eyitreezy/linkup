import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet } from 'react-native';

export const kycColors = {
  primary: '#6C63FF',
  secondary: '#FF6584',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  text: '#1A1D26',
  muted: '#6B7280',
} as const;

export const kycShadow = {
  shadowColor: '#1A1D26',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

export const kycStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: kycColors.background,
  },
  card: {
    backgroundColor: kycColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...kycShadow,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: kycColors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: kycColors.muted,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  bullets: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  bullet: { color: kycColors.primary, fontSize: 16, marginRight: spacing.sm, fontWeight: '700' },
  bulletText: { flex: 1, fontSize: 15, color: kycColors.text, lineHeight: 22 },
  /** Match onboarding `OnboardingProgress` spacing + track; keep KYC purple fill. */
  progressWrap: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 200,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 200,
    backgroundColor: kycColors.primary,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: kycColors.muted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
});
