/**
 * Skeletal placeholders for Plan management — matches plan card layout.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

function PlanCardSkeleton() {
  return (
    <View style={styles.planCard}>
      <View style={styles.planStripe} />
      <View style={styles.planBody}>
        <View style={styles.cardTop}>
          <View style={styles.titleCol}>
            <View style={styles.titleBone} />
            <View style={styles.titleBoneShort} />
            <View style={styles.metaBone} />
          </View>
          <View style={styles.pillBone} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBone} />
          <View style={styles.statBone} />
        </View>
        <View style={styles.actionsRow}>
          <View style={styles.actionBone} />
          <View style={styles.actionBone} />
          <View style={styles.actionBone} />
        </View>
      </View>
    </View>
  );
}

/** Hero stat + hint while plan counts are loading. */
export function PlanManagementHeroSkeleton() {
  return (
    <View style={styles.heroSkel}>
      <View style={styles.heroStatBone} />
      <View style={styles.heroHintBone} />
      <View style={styles.heroHintBoneShort} />
    </View>
  );
}

export function PlanManagementListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }, (_, i) => (
        <PlanCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.xs },
  heroSkel: { gap: 10, marginTop: 4 },
  heroStatBone: {
    width: 56,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  heroHintBone: {
    width: '92%',
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroHintBoneShort: {
    width: '70%',
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  planCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  planStripe: {
    width: 4,
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
  },
  planBody: { flex: 1, padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleCol: { flex: 1, gap: 8 },
  titleBone: {
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
    width: '88%',
  },
  titleBoneShort: {
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    width: '62%',
  },
  metaBone: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.1)',
    width: '48%',
    marginTop: 2,
  },
  pillBone: {
    width: 44,
    height: 24,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255, 101, 132, 0.12)',
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBone: {
    width: 88,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBone: {
    width: 64,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
});
