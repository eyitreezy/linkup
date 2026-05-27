/**
 * Smooth keyboard height + progress on the UI thread (Reanimated).
 * iOS: prefer `keyboardWillShow/Hide` with native duration when provided.
 * Android: `keyboardDidShow/Hide` (pairs with `adjustResize` — use lift only when needed).
 */
import { useEffect } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SHOW_FALLBACK_MS = 280;
const HIDE_FALLBACK_MS = 220;

function timingFromEvent(e: KeyboardEvent, fallback: number) {
  const raw = (e as KeyboardEvent & { duration?: number }).duration;
  return typeof raw === 'number' && raw > 0 ? Math.min(Math.max(raw, 120), 340) : fallback;
}

export type UseKeyboardAnimationOptions = {
  enabled?: boolean;
};

export function useKeyboardAnimation(options: UseKeyboardAnimationOptions = {}) {
  const { enabled = true } = options;
  const keyboardHeight = useSharedValue(0);
  const progress = useSharedValue(0);

  const isIos = Platform.OS === 'ios';
  const applyComposerLift = isIos;

  useEffect(() => {
    if (!enabled) return;

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates.height;
      const ms = timingFromEvent(e, SHOW_FALLBACK_MS);
      keyboardHeight.value = withTiming(h, { duration: ms, easing: Easing.out(Easing.cubic) });
      progress.value = withTiming(1, { duration: ms, easing: Easing.out(Easing.cubic) });
    };

    const onHide = (e: KeyboardEvent) => {
      const ms = timingFromEvent(e, HIDE_FALLBACK_MS);
      keyboardHeight.value = withTiming(0, { duration: ms, easing: Easing.out(Easing.cubic) });
      progress.value = withTiming(0, { duration: ms, easing: Easing.out(Easing.cubic) });
    };

    const showEvent = isIos ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = isIos ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [enabled, isIos]);

  /** Lift a bottom composer above the IME (iOS). Android: empty (window resize). */
  const composerLiftStyle = useAnimatedStyle(() => {
    if (!applyComposerLift) return {};
    const lift = keyboardHeight.value;
    return {
      transform: [{ translateY: -lift }],
    };
  });

  /** Extra list footer so the last bubble can scroll clear of the composer + IME (iOS). */
  const chatListFooterStyle = useAnimatedStyle(() => {
    const base = 10;
    if (!applyComposerLift) return { height: base };
    return { height: base + keyboardHeight.value * 0.28 };
  });

  /** Subtle dim behind keyboard/input focus (optional overlay). */
  const typingBackdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.07,
  }));

  return {
    keyboardHeight,
    progress,
    composerLiftStyle,
    chatListFooterStyle,
    typingBackdropStyle,
    /** Whether translateY-based composer lift is applied (iOS only). */
    applyComposerLift,
  };
}
