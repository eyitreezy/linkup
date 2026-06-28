/**
 * Premium auth shell — full-bleed hero background, editorial copy above glass card.
 */
import { AuthGlassCard } from '@/components/auth/AuthGlassCard';
import { AuthHeroBackground } from '@/components/auth/AuthHeroBackground';
import { AuthHeroCopy } from '@/components/auth/AuthHeroCopy';
import { AuthHeroDots } from '@/components/auth/AuthHeroDots';
import { AuthSheetScrollContext } from '@/components/auth/AuthSheetScrollContext';
import { spacing } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  belowCard?: ReactNode;
  /** Hide carousel headlines (password reset sub-flows). */
  showHeroCopy?: boolean;
  showPagination?: boolean;
};

const SPRING = { friction: 10, tension: 78, useNativeDriver: true as const };

function useMountEntrance() {
  const cardY = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.delay(80),
        Animated.parallel([
          Animated.spring(cardY, { ...SPRING, toValue: 0 }),
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.spring(formY, { ...SPRING, toValue: 0 }),
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = {
    opacity: cardOpacity,
    transform: [
      {
        translateY: cardY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 28],
        }),
      },
    ],
  };

  const formStyle = {
    opacity: formOpacity,
    transform: [
      {
        translateY: formY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 12],
        }),
      },
    ],
  };

  return { cardStyle, formStyle };
}

const FIELD_ABOVE_KEYBOARD_PAD = 16;
const ANDROID_IME_SHORT_LAYOUT_MARGIN_PX = 72;
const ANDROID_IME_FULL_WINDOW_SLACK_PX = 32;
const KEYBOARD_SCROLL_RETRY_MS = Platform.OS === 'ios' ? [80, 180, 320] : [50, 120, 220, 360];

export function DatingAuthShell({
  children,
  belowCard,
  showHeroCopy = true,
  showPagination = true,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);
  const pendingFieldRef = useRef<RefObject<View | null> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollInnerRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const fieldScrollRaf = useRef<number | null>(null);
  const fieldScrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fullWindowBaselineRef = useRef(windowHeight);
  const sawShortLayoutDuringImeRef = useRef(false);

  const { cardStyle, formStyle } = useMountEntrance();

  const clearKeyboardUi = useCallback(() => {
    keyboardHeightRef.current = 0;
    keyboardTopRef.current = null;
    pendingFieldRef.current = null;
    sawShortLayoutDuringImeRef.current = false;
    setKeyboardHeight(0);
    setKeyboardOpen(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!keyboardOpen) {
      fullWindowBaselineRef.current = Math.max(fullWindowBaselineRef.current, windowHeight);
    }
  }, [keyboardOpen, windowHeight]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !keyboardOpen) return;
    const baseline = fullWindowBaselineRef.current;
    if (baseline < 240) return;
    const shortCutoff = baseline - ANDROID_IME_SHORT_LAYOUT_MARGIN_PX;
    if (windowHeight <= shortCutoff) {
      sawShortLayoutDuringImeRef.current = true;
      return;
    }
    if (
      sawShortLayoutDuringImeRef.current &&
      windowHeight >= baseline - ANDROID_IME_FULL_WINDOW_SLACK_PX
    ) {
      clearKeyboardUi();
    }
  }, [windowHeight, keyboardOpen, clearKeyboardUi]);

  useEffect(() => {
    return () => {
      fieldScrollTimersRef.current.forEach(clearTimeout);
      fieldScrollTimersRef.current = [];
    };
  }, []);

  const scrollFieldIntoViewRef = useRef<(fieldRef: RefObject<View | null>) => void>(() => {});

  const scrollFieldIntoView = useCallback(
    (fieldRef: RefObject<View | null>) => {
      pendingFieldRef.current = fieldRef;
      const field = fieldRef.current;
      const scrollView = scrollRef.current;
      if (!field || !scrollView) return;

      const resolveKeyboardTop = () => {
        if (keyboardTopRef.current != null) return keyboardTopRef.current;
        const kb = keyboardHeightRef.current;
        return kb > 0 ? windowHeight - kb : windowHeight;
      };

      const run = () => {
        const scrollMeasurable = scrollView as unknown as View;
        scrollMeasurable.measureInWindow((_sx, sy, _sw, sh) => {
          const keyboardTop = resolveKeyboardTop();
          const visibleBottom = Math.min(sy + sh, keyboardTop) - FIELD_ABOVE_KEYBOARD_PAD;

          field.measureInWindow((_fx, fy, _fw, fh) => {
            const fieldBottom = fy + fh;
            if (fieldBottom <= visibleBottom) return;

            const overlap = fieldBottom - visibleBottom;
            scrollView.scrollTo({
              y: Math.max(0, scrollOffsetRef.current + overlap),
              animated: true,
            });
          });
        });
      };

      fieldScrollTimersRef.current.forEach(clearTimeout);
      fieldScrollTimersRef.current = [];
      if (fieldScrollRaf.current != null) cancelAnimationFrame(fieldScrollRaf.current);
      fieldScrollRaf.current = requestAnimationFrame(run);
      KEYBOARD_SCROLL_RETRY_MS.forEach((delay) => {
        fieldScrollTimersRef.current.push(setTimeout(run, delay));
      });
    },
    [windowHeight]
  );

  scrollFieldIntoViewRef.current = scrollFieldIntoView;

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates?: { height?: number; screenY?: number } }) => {
      const height = e.endCoordinates?.height ?? 0;
      const screenY = e.endCoordinates?.screenY;
      keyboardHeightRef.current = height;
      keyboardTopRef.current =
        typeof screenY === 'number' ? screenY : Math.max(0, windowHeight - height);
      if (Platform.OS === 'android') sawShortLayoutDuringImeRef.current = false;
      setKeyboardHeight(height);
      setKeyboardOpen(true);

      const pending = pendingFieldRef.current;
      if (pending?.current) {
        KEYBOARD_SCROLL_RETRY_MS.forEach((delay) => {
          fieldScrollTimersRef.current.push(
            setTimeout(() => scrollFieldIntoViewRef.current(pending), delay)
          );
        });
      }
    };
    const subShow = Keyboard.addListener(show, onShow);
    const subHide = Keyboard.addListener(hide, clearKeyboardUi);
    const subs: { remove: () => void }[] = [subShow, subHide];
    if (Platform.OS === 'android') {
      subs.push(
        Keyboard.addListener('keyboardDidChangeFrame', (e) => {
          const h = e.endCoordinates?.height ?? 0;
          const screenY = e.endCoordinates?.screenY;
          if (h > 2) {
            keyboardHeightRef.current = h;
            keyboardTopRef.current =
              typeof screenY === 'number' ? screenY : Math.max(0, windowHeight - h);
            setKeyboardHeight(h);
            setKeyboardOpen(true);
            const pending = pendingFieldRef.current;
            if (pending?.current) scrollFieldIntoViewRef.current(pending);
          }
        })
      );
    }
    return () => subs.forEach((s) => s.remove());
  }, [clearKeyboardUi, windowHeight]);

  useEffect(() => {
    if (!keyboardOpen || keyboardHeight <= 0) return;
    const pending = pendingFieldRef.current;
    if (!pending?.current) return;
    const frame = requestAnimationFrame(() => scrollFieldIntoViewRef.current(pending));
    return () => cancelAnimationFrame(frame);
  }, [keyboardOpen, keyboardHeight]);

  const sheetScrollApi = useMemo(
    () => ({ scrollFieldIntoView, keyboardOpen }),
    [scrollFieldIntoView, keyboardOpen]
  );

  const onScrollSheet = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const scrollBottomPad =
    Math.max(insets.bottom, spacing.md) +
    (keyboardOpen ? keyboardHeight + FIELD_ABOVE_KEYBOARD_PAD : 0);

  return (
    <AuthSheetScrollContext.Provider value={sheetScrollApi}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <AuthHeroBackground>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scrollRef}
              onScroll={onScrollSheet}
              scrollEventThrottle={16}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingTop: insets.top + spacing.sm,
                  paddingBottom: scrollBottomPad,
                },
                keyboardOpen && styles.scrollContentKeyboardOpen,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              bounces
            >
              <View ref={scrollInnerRef} collapsable={false} style={styles.scrollInner}>
                <View style={[styles.topSpacer, keyboardOpen && styles.topSpacerKeyboard]} />
                {showHeroCopy && !keyboardOpen ? <AuthHeroCopy /> : null}
                {!showHeroCopy && !keyboardOpen ? <View style={styles.copyPlaceholder} /> : null}
                {showHeroCopy && showPagination && !keyboardOpen ? <AuthHeroDots /> : null}
              <Animated.View style={cardStyle}>
                <AuthGlassCard>
                  <Animated.View style={formStyle}>{children}</Animated.View>
                </AuthGlassCard>
              </Animated.View>
              {belowCard ? (
                <Animated.View style={[styles.below, formStyle]}>{belowCard}</Animated.View>
              ) : null}
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </AuthHeroBackground>
      </View>
    </AuthSheetScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0D18' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollContentKeyboardOpen: { justifyContent: 'flex-end' },
  scrollInner: { flexGrow: 1, justifyContent: 'flex-end' },
  topSpacer: { flexGrow: 1, minHeight: 24 },
  topSpacerKeyboard: { flexGrow: 0, minHeight: 0, height: 8 },
  copyPlaceholder: { height: spacing.lg },
  below: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
