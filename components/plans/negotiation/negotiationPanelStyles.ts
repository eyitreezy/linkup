import { colors, radius, spacing } from '@/constants/theme';
import { Platform, StyleSheet } from 'react-native';

/** Shared surface styles — matches linkup-web `.linkup-card` and mobile hint card width. */
export const negotiationPanelStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#4C1D95',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.09,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  footer: {
    width: '100%',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
});
