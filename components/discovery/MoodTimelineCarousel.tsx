/**
 * Horizontal “Mood timeline” — live mood plans as compact pills that expand on web hover
 * (chevron on native). list + swipe Discover both use this header carousel.
 */
import { MoodPlanDiscoverPill } from '@/components/discovery/MoodPlanDiscoverPill';
import { colors, spacing } from '@/constants/theme';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type Props = {
  rows: PlanFeedRow[];
  onOpenPlan: (row: PlanFeedRow) => void;
};

export const MoodTimelineCarousel = memo(function MoodTimelineCarousel({ rows, onOpenPlan }: Props) {
  const { width: winW } = useWindowDimensions();
  const cardW = Math.min(380, Math.max(288, winW * 0.72));

  const renderItem = useCallback(
    ({ item, index }: { item: PlanFeedRow; index: number }) => (
      <MoodPlanDiscoverPill row={item} cardW={cardW} index={index} onOpenPlan={onOpenPlan} />
    ),
    [cardW, onOpenPlan]
  );

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.headEyebrow}>Live mood lane</Text>
        <Text style={styles.sectionTitle}>Mood timeline</Text>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headAccent}
        />
        <Text style={styles.sectionSub}>Live sparks — open a plan from the pill, expand for the full card</Text>
      </View>
      <FlatList
        horizontal
        data={rows}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        style={styles.list}
        contentContainerStyle={styles.listPad}
        ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  headRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  headEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.35 },
  headAccent: {
    marginTop: 10,
    height: 3,
    width: 52,
    borderRadius: 2,
    marginBottom: 8,
  },
  sectionSub: { fontSize: 13, color: colors.textMuted, fontWeight: '600', lineHeight: 18 },
  list: { overflow: 'visible' },
  listPad: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    alignItems: 'flex-start',
  },
});
