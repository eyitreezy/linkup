import { ActionButtonsSkeleton } from '@/components/plans/ActionButtonsSkeleton';
import { PlanOffersListSkeleton } from '@/components/plans/PlanOffersListSkeleton';
import { SkeletonBox } from '@/components/ui/SkeletonBox';
import { spacing } from '@/constants/theme';
import { ScrollView, StyleSheet, View } from 'react-native';

/** Meetup details shell while plan + offers load (no full-screen spinner). */
export function PlanDetailSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Loading meetup details"
      accessibilityState={{ busy: true }}
    >
      <View style={styles.heroCard}>
        <SkeletonBox style={styles.heroBanner} />
        <View style={styles.heroBody}>
          <SkeletonBox style={styles.titleLine} />
          <SkeletonBox style={styles.titleLineShort} />
          <View style={styles.metaRow}>
            <SkeletonBox style={styles.metaChip} />
            <SkeletonBox style={styles.metaChip} />
          </View>
        </View>
      </View>
      <ActionButtonsSkeleton />
      <View style={styles.offersSection}>
        <SkeletonBox style={styles.sectionTitle} />
        <SkeletonBox style={styles.sectionSub} />
        <PlanOffersListSkeleton />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  heroCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroBanner: {
    height: 120,
    borderRadius: 0,
  },
  heroBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  titleLine: {
    height: 22,
    width: '78%',
    borderRadius: 8,
  },
  titleLineShort: {
    height: 16,
    width: '52%',
    borderRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaChip: {
    height: 28,
    width: 96,
    borderRadius: 14,
  },
  offersSection: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    height: 18,
    width: 140,
    borderRadius: 6,
  },
  sectionSub: {
    height: 14,
    width: '85%',
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
});
