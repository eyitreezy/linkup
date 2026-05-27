import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const SPRING = {
  stiffness: 320,
  damping: 30,
  mass: 0.92,
};

function lightHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    /* Unavailable on many Android emulators / web; avoid logging. */
  });
}

function withRubberBand(value: number, min: number, max: number, factor = 0.52): number {
  'worklet';
  if (value < min) return min - (min - value) * factor;
  if (value > max) return max + (value - max) * factor;
  return value;
}

function buildSnaps(expandedHeight: number, collapsedHeight: number, midHeight: number): number[] {
  const maxT = Math.max(0, expandedHeight - collapsedHeight);
  const midT = Math.max(0, Math.min(expandedHeight - midHeight, maxT));
  const raw = [0, midT, maxT];
  const sorted = [...new Set(raw.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
  if (sorted.length >= 2) return sorted;
  return maxT > 0 ? [0, maxT] : [0];
}

function nearestSnapWithVelocity(
  current: number,
  velocityY: number,
  snaps: number[]
): number {
  'worklet';
  if (snaps.length === 0) return 0;
  if (snaps.length === 1) return snaps[0];

  const prediction = current + velocityY * 0.17;
  let best = snaps[0];
  let bestDist = Math.abs(prediction - best);
  for (let i = 1; i < snaps.length; i++) {
    const d = Math.abs(prediction - snaps[i]);
    if (d < bestDist) {
      best = snaps[i];
      bestDist = d;
    }
  }

  if (velocityY < -720) {
    const candidates = snaps.filter((s) => s <= current + 6);
    if (candidates.length) best = Math.min(...candidates);
  } else if (velocityY > 720) {
    const candidates = snaps.filter((s) => s >= current - 6);
    if (candidates.length) best = Math.max(...candidates);
  }

  return best;
}

export type DraggableSheetSnapIndex = 0 | 1 | 2;

export type DraggableSheetController = {
  /** Positive translate pushes the sheet down (more collapsed). Range [0, maxTranslate]. */
  translateY: SharedValue<number>;
  maxTranslate: number;
  panGesture: ReturnType<typeof Gesture.Pan>;
  sheetAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  backdropAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  sheetShadowStyle: ReturnType<typeof useAnimatedStyle>;
  expand: () => void;
  collapse: () => void;
  snapToMid: () => void;
  snapTo: (index: DraggableSheetSnapIndex) => void;
};

export function useDraggableSheet(options: {
  expandedHeight: number;
  collapsedHeight: number;
  midHeight: number;
}): DraggableSheetController {
  const { expandedHeight, collapsedHeight, midHeight } = options;

  const maxTranslate = Math.max(0, expandedHeight - collapsedHeight);
  const snaps = useMemo(
    () => buildSnaps(expandedHeight, collapsedHeight, midHeight),
    [expandedHeight, collapsedHeight, midHeight]
  );

  const translateY = useSharedValue(maxTranslate);
  const startY = useSharedValue(0);
  const prevMaxTRef = useRef(maxTranslate);

  useEffect(() => {
    const prev = prevMaxTRef.current;
    if (prev > 0.5 && Math.abs(maxTranslate - prev) > 0.5) {
      translateY.value = (translateY.value / prev) * maxTranslate;
    }
    prevMaxTRef.current = maxTranslate;
    translateY.value = Math.max(0, Math.min(maxTranslate, translateY.value));
  }, [maxTranslate, translateY]);

  const animateTo = useCallback(
    (y: number) => {
      const target = Math.max(0, Math.min(maxTranslate, y));
      translateY.value = withSpring(target, SPRING, (finished) => {
        if (finished) runOnJS(lightHaptic)();
      });
    },
    [maxTranslate, translateY]
  );

  const expand = useCallback(() => animateTo(0), [animateTo]);
  const collapse = useCallback(() => animateTo(maxTranslate), [animateTo, maxTranslate]);

  const snapToMid = useCallback(() => {
    const midT = snaps.length >= 2 ? snaps[Math.min(1, snaps.length - 2)] : snaps[0];
    animateTo(midT);
  }, [animateTo, snaps]);

  const snapTo = useCallback(
    (index: DraggableSheetSnapIndex) => {
      const i = Math.min(index, snaps.length - 1);
      animateTo(snaps[i] ?? maxTranslate);
    },
    [animateTo, snaps, maxTranslate]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .onStart(() => {
          'worklet';
          startY.value = translateY.value;
        })
        .onUpdate((e) => {
          'worklet';
          translateY.value = withRubberBand(startY.value + e.translationY, 0, maxTranslate);
        })
        .onEnd((e) => {
          'worklet';
          const target = nearestSnapWithVelocity(translateY.value, e.velocityY, snaps);
          translateY.value = withSpring(target, SPRING, (finished) => {
            if (finished) runOnJS(lightHaptic)();
          });
        }),
    [maxTranslate, snaps]
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const p = maxTranslate > 0.5 ? translateY.value / maxTranslate : 1;
    return {
      opacity: interpolate(p, [0, 1], [0.86, 1], 'clamp'),
      transform: [{ scale: interpolate(p, [0, 1], [0.982, 1], 'clamp') }],
    };
  });

  const sheetShadowStyle = useAnimatedStyle(() => {
    const lift = maxTranslate > 0.5 ? 1 - translateY.value / maxTranslate : 0;
    const shadowOpacity = 0.07 + lift * 0.14;
    const shadowRadius = 14 + lift * 16;
    const elevation = 3 + lift * 11;
    return Platform.OS === 'ios'
      ? {
          shadowColor: '#1A1D26',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity,
          shadowRadius,
        }
      : { elevation };
  });

  return {
    translateY,
    maxTranslate,
    panGesture,
    sheetAnimatedStyle,
    backdropAnimatedStyle,
    sheetShadowStyle,
    expand,
    collapse,
    snapToMid,
    snapTo,
  };
}
