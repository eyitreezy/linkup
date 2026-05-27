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

const SCROLL_TOP_PAD = 12;
const FIELD_ABOVE_KEYBOARD_PAD = 12;
const ANDROID_IME_SHORT_LAYOUT_MARGIN_PX = 72;
const ANDROID_IME_FULL_WINDOW_SLACK_PX = 32;

export function DatingAuthShell({
  children,
  belowCard,
  showHeroCopy = true,
  showPagination = true,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardHeightRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollInnerRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const fieldScrollRaf = useRef<number | null>(null);
  const fieldScrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const keyboardOpenRef = useRef(false);
  keyboardOpenRef.current = keyboardOpen;
  const fullWindowBaselineRef = useRef(windowHeight);
  const sawShortLayoutDuringImeRef = useRef(false);

  const { cardStyle, formStyle } = useMountEntrance();

  const clearKeyboardUi = useCallback(() => {
    keyboardHeightRef.current = 0;
    sawShortLayoutDuringImeRef.current = false;
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
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      keyboardHeightRef.current = e.endCoordinates?.height ?? 0;
      if (Platform.OS === 'android') sawShortLayoutDuringImeRef.current = false;
      setKeyboardOpen(true);
    };
    const subShow = Keyboard.addListener(show, onShow);
    const subHide = Keyboard.addListener(hide, clearKeyboardUi);
    const subs: { remove: () => void }[] = [subShow, subHide];
    if (Platform.OS === 'android') {
      subs.push(
        Keyboard.addListener('keyboardDidChangeFrame', (e) => {
          const h = e.endCoordinates?.height ?? 0;
          if (h > 2) keyboardHeightRef.current = h;
        })
      );
    }
    return () => subs.forEach((s) => s.remove());
  }, [clearKeyboardUi]);

  useEffect(() => {
    return () => {
      fieldScrollTimersRef.current.forEach(clearTimeout);
      fieldScrollTimersRef.current = [];
    };
  }, []);

  const scrollFieldIntoView = useCallback(
    (fieldRef: RefObject<View | null>) => {
      const field = fieldRef.current;
      const scrollView = scrollRef.current;
      const inner = scrollInnerRef.current;
      if (!field || !scrollView || !inner) return;
      const scrollMeasurable = scrollView as unknown as View;

      type MeasureLayoutHost = View & {
        measureLayout?: (
          relative: View,
          onSuccess: (x: number, y: number, w: number, h: number) => void,
          onFail?: () => void
        ) => void;
      };

      const run = () => {
        const scrollByWindowOverlap = () => {
          field.measureInWindow((fx, fy, _fw, fh) => {
            scrollMeasurable.measureInWindow((_sx, sy, _sw, sh) => {
              const kb = keyboardOpenRef.current ? keyboardHeightRef.current : 0;
              const keyboardTop = windowHeight - kb;
              let visibleBottom = sy + sh;
              if (kb > 0) visibleBottom = Math.min(visibleBottom, keyboardTop);
              const fieldBottom = fy + fh;
              const bottomPad = FIELD_ABOVE_KEYBOARD_PAD + (kb > 0 ? 0 : Math.max(insets.bottom, spacing.xs));
              let delta = 0;
              if (fieldBottom > visibleBottom - bottomPad) {
                delta += fieldBottom - (visibleBottom - bottomPad);
              }
              const visibleTop = sy + SCROLL_TOP_PAD + insets.top;
              if (fy < visibleTop) delta -= visibleTop - fy;
              if (delta !== 0) {
                scrollView.scrollTo({ y: Math.max(0, scrollOffsetRef.current + delta), animated: true });
              }
            });
          });
        };

        const host = field as MeasureLayoutHost;
        if (typeof host.measureLayout === 'function') {
          host.measureLayout(
            inner,
            (_x, y, _w, h) => {
              scrollMeasurable.measureInWindow((_sx, sy, _sw, sh) => {
                const kb = keyboardOpenRef.current ? keyboardHeightRef.current : 0;
                const keyboardTop = windowHeight - kb;
                let visibleH = sh;
                if (kb > 0) {
                  visibleH = Math.max(160, sh - Math.max(0, sy + sh - keyboardTop));
                }
                const bottomPad = FIELD_ABOVE_KEYBOARD_PAD + (kb > 0 ? 0 : Math.max(insets.bottom, spacing.xs));
                let targetY = y + h - visibleH + bottomPad;
                targetY = Math.min(Math.max(0, targetY), Math.max(0, y - SCROLL_TOP_PAD));
                scrollView.scrollTo({ y: targetY, animated: true });
              });
            },
            scrollByWindowOverlap
          );
        } else {
          scrollByWindowOverlap();
        }
      };

      fieldScrollTimersRef.current.forEach(clearTimeout);
      fieldScrollTimersRef.current = [];
      if (fieldScrollRaf.current != null) cancelAnimationFrame(fieldScrollRaf.current);
      fieldScrollRaf.current = requestAnimationFrame(run);
      fieldScrollTimersRef.current.push(setTimeout(run, Platform.OS === 'ios' ? 100 : 140));
    },
    [windowHeight, insets.bottom, insets.top]
  );

  const sheetScrollApi = useMemo(() => ({ scrollFieldIntoView }), [scrollFieldIntoView]);

  const onScrollSheet = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  return (
    <AuthSheetScrollContext.Provider value={sheetScrollApi}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <AuthHeroBackground>
          <ScrollView
            ref={scrollRef}
            onScroll={onScrollSheet}
            scrollEventThrottle={16}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + spacing.sm,
                paddingBottom:
                  Math.max(insets.bottom, spacing.md) + (keyboardOpen ? FIELD_ABOVE_KEYBOARD_PAD + 8 : 0),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces
          >
            <View ref={scrollInnerRef} collapsable={false} style={styles.scrollInner}>
              <View style={styles.topSpacer} />
              {showHeroCopy ? <AuthHeroCopy /> : <View style={styles.copyPlaceholder} />}
              {showHeroCopy && showPagination ? <AuthHeroDots /> : null}
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
        </AuthHeroBackground>
      </View>
    </AuthSheetScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0D18' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollInner: { flexGrow: 1, justifyContent: 'flex-end' },
  topSpacer: { flexGrow: 1, minHeight: 24 },
  copyPlaceholder: { height: spacing.lg },
  below: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
