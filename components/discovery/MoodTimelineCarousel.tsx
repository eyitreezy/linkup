/**
 * Horizontal mood timeline — compact pills only; list + swipe Discover.
 */
import { MoodPlanDiscoverPill } from '@/components/discovery/MoodPlanDiscoverPill';
import { spacing } from '@/constants/theme';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

type Props = {
  rows: PlanFeedRow[];
  onOpenPlan: (row: PlanFeedRow) => void;
  currentUserId?: string;
};

export const MoodTimelineCarousel = memo(function MoodTimelineCarousel({
  rows,
  onOpenPlan,
  currentUserId,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const cardW = Math.min(360, Math.max(272, winW * 0.68));

  const renderItem = useCallback(
    ({ item, index }: { item: PlanFeedRow; index: number }) => (
      <MoodPlanDiscoverPill
        row={item}
        cardW={cardW}
        index={index}
        onOpenPlan={onOpenPlan}
        currentUserId={currentUserId}
      />
    ),
    [cardW, onOpenPlan, currentUserId]
  );

  if (rows.length === 0) return null;

  return (
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
  );
});

const styles = StyleSheet.create({
  list: { overflow: 'visible' },
  listPad: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    alignItems: 'flex-start',
  },
});
