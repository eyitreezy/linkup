/**
 * LinkedIn-style tab bar: hide when scrolling down the feed, show when scrolling up.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

const ANIM_MS = 240;
const SCROLL_DELTA = 8;
/** Fallback until LinkUpTabBar reports layout (indicator + tabs + safe area). */
export const DEFAULT_TAB_BAR_INSET = 72;

type TabBarVisibilityContextValue = {
  translateY: SharedValue<number>;
  tabBarHeight: SharedValue<number>;
  /** Measured tab bar height (includes bottom safe area) for screen bottom padding. */
  tabBarInset: number;
  tabBarAnimatedStyle: AnimatedStyle<ViewStyle>;
  setTabBarHeight: (height: number) => void;
  showTabBar: () => void;
  hideTabBar: () => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const translateY = useSharedValue(0);
  const tabBarHeight = useSharedValue(DEFAULT_TAB_BAR_INSET);
  const [tabBarInset, setTabBarInset] = useState(DEFAULT_TAB_BAR_INSET);

  const showTabBar = useCallback(() => {
    translateY.value = withTiming(0, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [translateY]);

  const hideTabBar = useCallback(() => {
    translateY.value = withTiming(tabBarHeight.value, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [translateY, tabBarHeight]);

  const setTabBarHeight = useCallback(
    (height: number) => {
      if (height > 0) {
        tabBarHeight.value = height;
        setTabBarInset(height);
      }
    },
    [tabBarHeight]
  );

  /** Collapse height (no translateY) so the navigator slot does not leave a blank strip. */
  const tabBarAnimatedStyle = useAnimatedStyle(() => {
    const h = tabBarHeight.value;
    const ty = translateY.value;
    if (h <= 0) {
      return { overflow: 'hidden' as const };
    }
    const visible = Math.max(0, h - ty);
    return {
      height: visible,
      opacity: visible / h,
      overflow: 'hidden' as const,
    };
  });

  const value = useMemo(
    () => ({
      translateY,
      tabBarHeight,
      tabBarInset,
      tabBarAnimatedStyle,
      setTabBarHeight,
      showTabBar,
      hideTabBar,
    }),
    [translateY, tabBarHeight, tabBarInset, tabBarAnimatedStyle, setTabBarHeight, showTabBar, hideTabBar]
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility(): TabBarVisibilityContextValue {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  }
  return ctx;
}

export function useTabBarVisibilityOptional(): TabBarVisibilityContextValue | null {
  return useContext(TabBarVisibilityContext);
}

/** Re-export scroll delta for tests / tuning */
export const TAB_BAR_SCROLL_DELTA = SCROLL_DELTA;
