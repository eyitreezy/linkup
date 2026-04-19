/**
 * LinkedIn-style bottom tabs: hairline top border, primary top bar on active tab, solid icons.
 */
import { useNotificationInboxOptional } from '@/contexts/NotificationInboxContext';
import { colors } from '@/constants/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INACTIVE_TAB = '#6B7280';
const INDICATOR_HEIGHT = 3;

export function LinkUpTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const inbox = useNotificationInboxOptional();
  const unread = inbox?.unreadCount ?? 0;

  return (
    <View
      style={[
        styles.wrap,
        Platform.OS === 'android' ? { paddingBottom: Math.max(insets.bottom, 8) } : { paddingBottom: insets.bottom },
      ]}
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
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
