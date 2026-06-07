/**
 * In-screen title bar for plan/[id] flows — glass nav aligned with notification / membership screens.
 */
import { PlanStackHeaderBack } from '@/components/navigation/PlanStackHeaderBack';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const SLOT = 44;

type Props = {
  title: string;
  /** Small label above title (e.g. Meetup details). */
  kicker?: string;
  barStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  /** Trailing action (e.g. report). */
  right?: ReactNode;
};

export function PlanStackScreenHeader({ title, kicker, barStyle, titleStyle, right }: Props) {
  return (
    <View style={[styles.bar, barStyle]}>
      <View style={styles.slot}>
        <PlanStackHeaderBack />
      </View>
      <View style={styles.titleCol}>
        {kicker ? (
          <>
            <Text style={styles.kicker} numberOfLines={1}>
              {kicker}
            </Text>
            <Text style={[styles.title, titleStyle]} numberOfLines={1}>
              {title}
            </Text>
          </>
        ) : (
          <>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.titleMark}
            />
            <Text style={[styles.heroTitle, titleStyle]} numberOfLines={1}>
              {title}
            </Text>
          </>
        )}
      </View>
      <View style={[styles.slot, styles.slotRight]}>{right ?? <View style={styles.slotSpacer} />}</View>
    </View>
  );
}

/** Gradient flag action — stays top-right; glass ring + brand fill. */
export function PlanReportFlagButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.flagOuter}>
      <LinearGradient
        colors={[colors.primary, '#8B7CE8', colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.flagGradRing}
      >
        <PlanReportFlagButtonInner onPress={onPress} />
      </LinearGradient>
    </View>
  );
}

function PlanReportFlagButtonInner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Report this plan"
      accessibilityRole="button"
      style={({ pressed }) => [styles.flagInner, pressed && styles.flagPressed]}
    >
      <Ionicons name="flag" size={18} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
    minHeight: 56,
  },
  slot: {
    width: SLOT,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  slotRight: {
    alignItems: 'flex-end',
  },
  slotSpacer: { width: SLOT, height: SLOT },
  titleCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.xs,
  },
  titleMark: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.55,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.35,
  },
  flagOuter: {
    borderRadius: radius.button + 2,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  flagGradRing: {
    padding: 2,
    borderRadius: radius.button + 2,
  },
  flagInner: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  flagPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
});
