import { SkeletonBox } from '@/components/ui/SkeletonBox';
import { spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

/** Recent offers rows while plan detail offers load. */
export function PlanOffersListSkeleton() {
  return (
    <View style={styles.list} accessibilityLabel="Loading offers" accessibilityState={{ busy: true }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBox style={styles.avatar} />
          <View style={styles.copy}>
            <SkeletonBox style={styles.lineLg} />
            <SkeletonBox style={styles.lineSm} />
          </View>
          <SkeletonBox style={styles.chip} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  lineLg: {
    height: 14,
    width: '45%',
    borderRadius: 6,
  },
  lineSm: {
    height: 12,
    width: '30%',
    borderRadius: 6,
  },
  chip: {
    width: 72,
    height: 28,
    borderRadius: 14,
  },
});
