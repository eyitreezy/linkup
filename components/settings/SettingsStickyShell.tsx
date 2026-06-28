/**
 * Settings / support screens — fixed top back row (membership-style), scrollable body below.
 */
import { Screen } from '@/components/Screen';
import {
  DISCOVERY_SHELL_GRADIENT,
  DISCOVERY_SHELL_GRADIENT_LOCATIONS,
} from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { useFullBleedAbsoluteFillStyle } from '@/hooks/useFullBleedAbsoluteFillStyle';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  /** Optional right side of top bar (badge, spacer is default). */
  topNavRight?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'handled' | 'always' | 'never';
  safeAreaEdges?: Edge[];
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function SettingsStickyTopNav({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.topNav}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      {right ?? <View style={styles.topNavSpacer} />}
    </View>
  );
}

export function SettingsStickyShell({
  children,
  topNavRight,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  safeAreaEdges = ['top', 'left', 'right'],
  refreshControl,
}: Props) {
  const bleedBgStyle = useFullBleedAbsoluteFillStyle();
  return (
    <Screen safeAreaEdges={safeAreaEdges} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={[...DISCOVERY_SHELL_GRADIENT]}
          locations={[...DISCOVERY_SHELL_GRADIENT_LOCATIONS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={bleedBgStyle}
          pointerEvents="none"
        />

        <SettingsStickyTopNav right={topNavRight} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topNavSpacer: { width: 44, height: 44 },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
});
