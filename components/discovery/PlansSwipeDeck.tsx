/**
 * Swipe deck for discovery feed — pan gestures + fast exit animations (Reanimated).
 */
import { DiscoverySwipeCard } from '@/components/discovery/DiscoverySwipeCard';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import type { PresenceUi } from '@/lib/presence/derivePresenceUi';
import { colors, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 96;
const EXIT_MS = 160;
const TILT_DEG = 12;
const MIN_DECK_HEIGHT = 420;

export type PlansSwipeDeckRef = {
  swipeLeft: () => void;
  swipeRight: () => void;
};

type Props = {
  items: PlanFeedRow[];
  distanceForRow: (row: PlanFeedRow) => number | null;
  viewerHasLocation?: boolean;
  onSwipeRight: (row: PlanFeedRow) => void;
  onSwipeLeft: (row: PlanFeedRow) => void;
  onPressCard: (row: PlanFeedRow) => void;
  presenceForRow: (row: PlanFeedRow) => PresenceUi | null;
  /** Fill the parent deck zone (discover swipe stage above action buttons). */
  layoutMode?: 'fill' | 'fixed';
  /** Used only when `layoutMode` is `fixed`. */
  minDeckHeight?: number;
};

const PlansSwipeDeckInner = forwardRef<PlansSwipeDeckRef, Props>(function PlansSwipeDeckInner(
  {
    items,
    distanceForRow,
    viewerHasLocation = true,
    onSwipeRight,
    onSwipeLeft,
    onPressCard,
    presenceForRow,
    layoutMode = 'fill',
    minDeckHeight,
  },
  ref
) {
  const fillParent = layoutMode === 'fill';
  const deckHeight = fillParent
    ? undefined
    : Math.max(minDeckHeight ?? 0, MIN_DECK_HEIGHT);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const locked = useSharedValue(false);
  const committedPlanIdRef = useRef<string | null>(null);

  const top = items[0] ?? null;
  const next = items[1] ?? null;

  useEffect(() => {
    locked.value = false;
    committedPlanIdRef.current = null;
    translateX.value = 0;
    translateY.value = 0;
  }, [top?.id, locked, translateX, translateY]);

  const commitSwipe = useCallback(
    (dir: 'left' | 'right') => {
      if (!top || committedPlanIdRef.current === top.id) return;
      committedPlanIdRef.current = top.id;
      locked.value = true;

      if (dir === 'right') onSwipeRight(top);
      else onSwipeLeft(top);

      const target = dir === 'right' ? W * 1.25 : -W * 1.25;
      translateX.value = withTiming(target, { duration: EXIT_MS });
      translateY.value = withTiming(0, { duration: EXIT_MS });
    },
    [top, onSwipeLeft, onSwipeRight, locked, translateX, translateY]
  );

  const triggerSwipe = useCallback(
    (dir: 'left' | 'right') => {
      commitSwipe(dir);
    },
    [commitSwipe]
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
      if (locked.value) return;
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      if (locked.value) return;
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(commitSwipe)('right');
        return;
      }
      if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(commitSwipe)('left');
        return;
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 280 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 280 });
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
      <View style={[styles.wrap, fillParent && styles.wrapFill, styles.doneWrap]}>
        <View style={styles.done}>
          <Text style={styles.doneEmoji}>✨</Text>
          <Text style={styles.doneTitle}>You’re all caught up</Text>
          <Text style={styles.doneSub}>Open filters to switch views or pull to refresh for more meetup ideas nearby.</Text>
        </View>
      </View>
    );
  }

  const stackStyle = fillParent
    ? styles.cardStackFill
    : [styles.cardStack, { height: deckHeight, minHeight: deckHeight }];

  return (
    <View style={[styles.wrap, fillParent && styles.wrapFill]}>
      <View style={stackStyle}>
        {next ? (
          <View style={[styles.cardFace, styles.cardBehind]} pointerEvents="none">
            <DiscoverySwipeCard
              row={next}
              distanceKm={distanceForRow(next)}
              viewerHasLocation={viewerHasLocation}
              presence={presenceForRow(next)}
              onPress={() => {}}
            />
          </View>
        ) : null}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.cardFace, topStyle]}>
            <DiscoverySwipeCard
              row={top}
              distanceKm={distanceForRow(top)}
              viewerHasLocation={viewerHasLocation}
              presence={presenceForRow(top)}
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
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
    paddingTop: 0,
    paddingBottom: spacing.xs,
  },
  wrapFill: {
    flex: 1,
    paddingBottom: 0,
    justifyContent: 'flex-end',
  },
  doneWrap: {
    justifyContent: 'center',
  },
  cardStack: {
    position: 'relative',
    width: '100%',
  },
  cardStackFill: {
    position: 'relative',
    width: '100%',
    flex: 1,
    minHeight: MIN_DECK_HEIGHT,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1035',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
      },
      android: { elevation: 16 },
    }),
  },
  cardBehind: {
    transform: [{ scale: 0.965 }, { translateY: 6 }],
    opacity: 0.88,
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
  stampTxt: { marginTop: 4, fontSize: 13, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.secondary },
  done: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  doneEmoji: { fontSize: 40, marginBottom: spacing.sm, fontFamily: fonts.regular, },
  doneTitle: { fontSize: 20, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  doneSub: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
