import { TAB_BAR_SCROLL_DELTA, useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import {
  Easing,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const ANIM_MS = 240;

/** Attach to Animated.FlatList / Animated.ScrollView on tab screens. */
export function useTabBarScrollHandler() {
  const { translateY, tabBarHeight } = useTabBarVisibility();
  const lastScrollY = useSharedValue(0);

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const dy = y - lastScrollY.value;

      if (y <= 4) {
        translateY.value = withTiming(0, {
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
        });
      } else if (dy > TAB_BAR_SCROLL_DELTA) {
        translateY.value = withTiming(tabBarHeight.value, {
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
        });
      } else if (dy < -TAB_BAR_SCROLL_DELTA) {
        translateY.value = withTiming(0, {
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
        });
      }

      lastScrollY.value = y;
    },
  });
}

export function useTabBarScrollProps() {
  const onScroll = useTabBarScrollHandler();
  return { onScroll, scrollEventThrottle: 16 as const };
}

/** Show tab bar when landing on a tab (e.g. swipe deck with no scroll). */
export function useShowTabBarOnFocus() {
  const { showTabBar } = useTabBarVisibility();
  useFocusEffect(
    useCallback(() => {
      showTabBar();
    }, [showTabBar])
  );
}
