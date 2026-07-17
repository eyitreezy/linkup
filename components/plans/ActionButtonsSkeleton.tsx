import { SkeletonBox } from '@/components/ui/SkeletonBox';
import { spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

/** Matches plan detail dual-action + host promote rows while offer context loads. */
export function ActionButtonsSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.primaryRow}>
        <SkeletonBox style={styles.primaryButton} />
        <SkeletonBox style={styles.primaryButton} />
      </View>
      <View style={styles.secondaryRow}>
        <SkeletonBox style={styles.secondaryButton} />
        <SkeletonBox style={styles.secondaryButton} />
        <SkeletonBox style={styles.secondaryButton} />
      </View>
    </View>
  );
}

const PLAN_DUAL_CTA_MIN_HEIGHT = 52;

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    flex: 1,
    height: PLAN_DUAL_CTA_MIN_HEIGHT,
    borderRadius: 300,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 300,
  },
});
