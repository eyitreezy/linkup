/**

 * LinkedIn-style bottom tabs: hairline top border, primary top bar on active tab, solid icons.

 * Hides on scroll down, shows on scroll up (see TabBarVisibilityContext).

 */

import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';

import { useTabBarVisibilityOptional } from '@/contexts/TabBarVisibilityContext';

import { colors } from '@/constants/theme';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useEffect } from 'react';

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Animated from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';



const INACTIVE_TAB = '#6B7280';

const INDICATOR_HEIGHT = 3;



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



  const barBody = (

    <View

      style={[styles.wrap, { paddingBottom: bottomPad }]}

      onLayout={(e) => setTabBarHeight?.(e.nativeEvent.layout.height)}

    >

      <View style={styles.indicatorRow} accessibilityRole="tablist">

        {state.routes.map((route, index) => {

          const focused = state.index === index;

          return (

            <View key={`in-${route.key}`} style={styles.indicatorSlot}>

              {focused ? <View style={styles.indicator} /> : <View style={styles.indicatorSpacer} />}

            </View>

          );

        })}

      </View>

      <View style={styles.tabsRow}>

        {state.routes.map((route, index) => {

          const { options } = descriptors[route.key];

          const focused = state.index === index;

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

              style={({ pressed }) => [

                styles.tab,

                { transform: [{ scale: pressed ? 0.94 : 1 }] },

              ]}

            >

              <View style={styles.iconSlot}>

                {icon}

                {showDot ? <View style={styles.notifDot} /> : null}

              </View>

              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>

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

    backgroundColor: colors.surface,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: colors.border,

    ...Platform.select({

      ios: {

        shadowColor: '#1A1D26',

        shadowOffset: { width: 0, height: -2 },

        shadowOpacity: 0.06,

        shadowRadius: 8,

      },

      android: { elevation: 8 },

    }),

  },

  indicatorRow: {

    flexDirection: 'row',

    height: INDICATOR_HEIGHT,

  },

  indicatorSlot: {

    flex: 1,

    alignItems: 'stretch',

  },

  indicator: {

    flex: 1,

    height: INDICATOR_HEIGHT,

    backgroundColor: colors.primary,

  },

  indicatorSpacer: {

    flex: 1,

    height: INDICATOR_HEIGHT,

  },

  tabsRow: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    paddingTop: 8,

    paddingBottom: 4,

  },

  iconSlot: {

    position: 'relative',

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

    borderColor: colors.surface,

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

    letterSpacing: -0.1,

  },

});


