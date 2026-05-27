/**
 * Swipe deck for discovery feed — pan gestures + spring animations (Reanimated).
 */
import { DiscoverySwipeCard } from '@/components/discovery/DiscoverySwipeCard';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 110;
const TILT_DEG = 12;

export type PlansSwipeDeckRef = {
  swipeLeft: () => void;
  swipeRight: () => void;
};

type Props = {
  items: PlanFeedRow[];
  index: number;
  onIndexChange: (next: number) => void;
  distanceForRow: (row: PlanFeedRow) => number | null;
  onSwipeRight: (row: PlanFeedRow) => void;
  onSwipeLeft: (row: PlanFeedRow) => void;
  onPressCard: (row: PlanFeedRow) => void;
};

const PlansSwipeDeckInner = forwardRef<PlansSwipeDeckRef, Props>(function PlansSwipeDeckInner(
  { items, index, onIndexChange, distanceForRow, onSwipeRight, onSwipeLeft, onPressCard },
  ref
) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const top = items[index] ?? null;
  const next = items[index + 1] ?? null;

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [index, top?.id, translateX, translateY]);

  const advance = useCallback(() => {
    onIndexChange(index + 1);
  }, [index, onIndexChange]);

  const completeRight = useCallback(() => {
    if (top) onSwipeRight(top);
    advance();
  }, [top, onSwipeRight, advance]);

  const completeLeft = useCallback(() => {
    if (top) onSwipeLeft(top);
    advance();
  }, [top, onSwipeLeft, advance]);

  const triggerSwipe = useCallback(
    (dir: 'left' | 'right') => {
      const target = dir === 'right' ? W * 1.4 : -W * 1.4;
      translateX.value = withSpring(target, { damping: 18, stiffness: 180 }, (finished) => {
        if (finished) {
          if (dir === 'right') runOnJS(completeRight)();
          else runOnJS(completeLeft)();
        }
      });
    },
    [translateX, completeRight, completeLeft]
  );

  useImperativeHandle(
    ref,
    () => ({
      swipeLeft: () => triggerSwipe('left'),
      swipeRight: () => triggerSwipe('right'),
    }),
    [triggerSwipe]
  );

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(W * 1.4, { damping: 18, stiffness: 180 }, (finished) => {
          if (finished) runOnJS(completeRight)();
        });
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-W * 1.4, { damping: 18, stiffness: 180 }, (finished) => {
          if (finished) runOnJS(completeLeft)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-W / 2, W / 2], [-TILT_DEG, TILT_DEG])}deg` },
    ],
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }));

  const passOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
  }));

  if (!top) {
    return (
      <View style={styles.done}>
        <Text style={styles.doneEmoji}>✨</Text>
        <Text style={styles.doneTitle}>You’re all caught up</Text>
        <Text style={styles.doneSub}>Switch to the list view or pull to refresh for more meetup ideas nearby.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.cardStack}>
        {next ? (
          <View style={[styles.cardFace, styles.cardBehind]} pointerEvents="none">
            <DiscoverySwipeCard row={next} distanceKm={distanceForRow(next)} onPress={() => {}} />
          </View>
        ) : null}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.cardFace, topStyle]}>
            <DiscoverySwipeCard
              row={top}
              distanceKm={distanceForRow(top)}
              onPress={() => onPressCard(top)}
            />
            <Animated.View style={[styles.stamp, styles.stampLike, likeOpacity]} pointerEvents="none">
              <Ionicons name="heart" size={42} color={colors.secondary} />
              <Text style={styles.stampTxt}>Into it</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, passOpacity]} pointerEvents="none">
              <Ionicons name="close" size={40} color={colors.textMuted} />
              <Text style={[styles.stampTxt, { color: colors.text }]}>Pass</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
});

export const PlansSwipeDeck = memo(PlansSwipeDeckInner);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
    paddingTop: 2,
    paddingBottom: 2,
  },
  cardStack: {
    flex: 1,
    minHeight: 260,
    position: 'relative',
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 12,
  },
  cardBehind: {
    transform: [{ scale: 0.96 }],
    opacity: 0.92,
  },
  stamp: {
    position: 'absolute',
    top: '38%',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
  },
  stampLike: {
    right: spacing.lg,
    borderColor: colors.secondary,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  stampPass: {
    left: spacing.lg,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  stampTxt: { marginTop: 4, fontSize: 13, fontWeight: '900', color: colors.secondary },
  done: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  doneEmoji: { fontSize: 40, marginBottom: spacing.sm },
  doneTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  doneSub: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
