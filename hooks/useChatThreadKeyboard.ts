/**
 * Chat thread keyboard — keeps the last bubbles visible above composer + IME.
 * Pairs with KeyboardStickyView + useKeyboardStickyFooterMode (adjustNothing on Android).
 */
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, type FlatList, type KeyboardEvent } from 'react-native';
import { useGenericKeyboardHandler } from 'react-native-keyboard-controller';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const LIST_KEYBOARD_GAP = 12;
const SHOW_FALLBACK_MS = 280;
const HIDE_FALLBACK_MS = 220;

type Options = {
  listRef: React.RefObject<FlatList<any> | null>;
  /** Extra space for reply bar, smart suggestions, quick actions, etc. */
  composerExtraHeight?: number;
};

export function useChatThreadKeyboard({ listRef, composerExtraHeight = 0 }: Options) {
  const keyboardInset = useSharedValue(0);
  const progress = useSharedValue(0);
  const stuckToBottomRef = useRef(true);

  useGenericKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        keyboardInset.value = Math.max(0, e.height);
        progress.value = e.progress;
      },
      onMove: (e) => {
        'worklet';
        keyboardInset.value = Math.max(0, e.height);
        progress.value = e.progress;
      },
      onEnd: (e) => {
        'worklet';
        keyboardInset.value = Math.max(0, e.height);
        progress.value = e.progress;
      },
    },
    [composerExtraHeight]
  );

  const scrollToBottom = useCallback(
    (animated = true) => {
      if (!stuckToBottomRef.current) return;
      listRef.current?.scrollToEnd({ animated });
    },
    [listRef]
  );

  const scrollToBottomForced = useCallback(
    (animated = true) => {
      listRef.current?.scrollToEnd({ animated });
    },
    [listRef]
  );

  const markNearBottom = useCallback((nearBottom: boolean) => {
    stuckToBottomRef.current = nearBottom;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates.height;
      keyboardInset.value = withTiming(h, {
        duration: SHOW_FALLBACK_MS,
        easing: Easing.out(Easing.cubic),
      });
      progress.value = withTiming(1, {
        duration: SHOW_FALLBACK_MS,
        easing: Easing.out(Easing.cubic),
      });
      requestAnimationFrame(() => scrollToBottomForced(true));
      setTimeout(() => scrollToBottomForced(false), 140);
      setTimeout(() => scrollToBottomForced(false), 320);
    };

    const onHide = () => {
      keyboardInset.value = withTiming(0, {
        duration: HIDE_FALLBACK_MS,
        easing: Easing.out(Easing.cubic),
      });
      progress.value = withTiming(0, {
        duration: HIDE_FALLBACK_MS,
        easing: Easing.out(Easing.cubic),
      });
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [keyboardInset, progress, scrollToBottomForced]);

  const listFooterStyle = useAnimatedStyle(() => ({
    height: keyboardInset.value + composerExtraHeight + LIST_KEYBOARD_GAP,
  }));

  const typingBackdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.07,
  }));

  const onComposerFocus = useCallback(() => {
    stuckToBottomRef.current = true;
    scrollToBottomForced(true);
    setTimeout(() => scrollToBottomForced(false), 120);
  }, [scrollToBottomForced]);

  const onListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      markNearBottom(distanceFromBottom < 96);
    },
    [markNearBottom]
  );

  const pinListToBottom = useCallback(() => {
    stuckToBottomRef.current = true;
    scrollToBottomForced(false);
    requestAnimationFrame(() => scrollToBottomForced(false));
    setTimeout(() => scrollToBottomForced(false), 60);
    setTimeout(() => scrollToBottomForced(false), 180);
    setTimeout(() => scrollToBottomForced(false), 400);
  }, [scrollToBottomForced]);

  return {
    listFooterStyle,
    typingBackdropStyle,
    scrollToBottom,
    scrollToBottomForced,
    pinListToBottom,
    onComposerFocus,
    onListScroll,
  };
}
