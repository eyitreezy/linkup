import { colors, radius, spacing } from '@/constants/theme';
import { Platform, StyleSheet } from 'react-native';

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

export const kycCtaShadow = Platform.select({
  ios: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  android: { elevation: 5 },
  default: {},
});

/** Inbox-aligned shell tokens (gradient screens, glass nav, lead blocks). */
export const kycInboxStyles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  body: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topNavBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  topNavBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.45,
    marginBottom: 6,
    lineHeight: 32,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  sectionHead: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  frostedCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
});

export const kycStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
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
    width: '100%',
    alignSelf: 'stretch',
  },
  progressTrack: {
    width: '100%',
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
    paddingHorizontal: spacing.md,
    letterSpacing: 0.3,
  },
});
