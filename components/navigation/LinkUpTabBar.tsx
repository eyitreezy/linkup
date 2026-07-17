/**
 * Bottom tabs — blush shell, pill active indicator, hide on scroll down.
 * Hides on scroll down, shows on scroll up (see TabBarVisibilityContext).
 */
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { useTabBarVisibilityOptional } from '@/contexts/TabBarVisibilityContext';
import { colors, fonts } from '@/constants/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INACTIVE_TAB = 'rgba(26, 29, 38, 0.42)';
const INDICATOR_HEIGHT = 3;
const INDICATOR_WIDTH = 28;
/** Matches screen shell — keeps bar visually merged with blush backdrop. */
const TAB_BAR_BG = colors.splashBackground;

export function LinkUpTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const inbox = useNotificationInboxOptional();
  const unread = inbox?.unreadCount ?? 0;
  const visibility = useTabBarVisibilityOptional();
  const tabBarAnimatedStyle = visibility?.tabBarAnimatedStyle;
  const setTabBarHeight = visibility?.setTabBarHeight;
  const showTabBar = visibility?.showTabBar;

  useEffect(() => {
    showTabBar?.();
  }, [state.index, showTabBar]);

  const bottomPad = Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom;

  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key].options;
    return typeof options.tabBarIcon === 'function';
  });

  const focusedRouteKey = state.routes[state.index]?.key;

  const barBody = (
    <View
      style={[styles.wrap, { paddingBottom: bottomPad }]}
      onLayout={(e) => setTabBarHeight?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.indicatorRow} accessibilityRole="tablist">
        {visibleRoutes.map((route) => {
          const focused = route.key === focusedRouteKey;
          return (
            <View key={`in-${route.key}`} style={styles.indicatorSlot}>
              {focused ? <View style={styles.indicator} /> : null}
            </View>
          );
        })}
      </View>

      <View style={styles.tabsRow}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === focusedRouteKey;
          const tint = focused ? colors.primary : INACTIVE_TAB;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const label =
            options.tabBarLabel !== undefined
              ? String(options.tabBarLabel)
              : options.title !== undefined
                ? String(options.title)
                : route.name;

          const icon =
            options.tabBarIcon?.({
              focused,
              color: tint,
              size: 24,
            }) ?? null;

          const showDot = route.name === 'profile' && unread > 0;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <View style={styles.iconSlot}>
                {icon}
                {showDot ? <View style={styles.notifDot} /> : null}
              </View>
              <Text
                style={[styles.label, focused && styles.labelActive, { color: tint }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (tabBarAnimatedStyle) {
    return (
      <Animated.View style={[styles.shell, tabBarAnimatedStyle]} pointerEvents="box-none">
        {barBody}
      </Animated.View>
    );
  }

  return <View style={styles.shell}>{barBody}</View>;
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  wrap: {
    backgroundColor: TAB_BAR_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  indicatorRow: {
    flexDirection: 'row',
    height: INDICATOR_HEIGHT,
    alignItems: 'flex-end',
  },
  indicatorSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: INDICATOR_HEIGHT,
  },
  indicator: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconSlot: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: TAB_BAR_BG,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.medium,
    letterSpacing: -0.1,
  },
  labelActive: {
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
});
