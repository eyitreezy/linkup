/**
 * Bumble-style selectable card for plan visibility (PL2).
 */
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  badge?: SubscriptionTier;
};

export function VisibilityPickCard({ title, description, icon, selected, onPress, badge }: Props) {
  const body = (
    <View style={styles.row}>
      {selected ? (
        <LinearGradient
          colors={[...APP_CHIP_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircleGrad}
        >
          <Ionicons name={icon} size={26} color="#fff" />
        </LinearGradient>
      ) : (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={26} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, selected && styles.titleOn]}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.body}>{description}</Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? colors.primary : colors.border}
      />
    </View>
  );

  if (selected) {
    return (
      <Pressable
        onPress={onPress}
        style={styles.cardOuter}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <LinearGradient
          colors={[...APP_CHIP_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradBorder}
        >
          <View style={styles.cardInner}>{body}</View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  cardGradBorder: {
    padding: 2,
    borderRadius: radius.xl,
  },
  cardInner: {
    padding: spacing.md,
    borderRadius: radius.xl - 2,
    backgroundColor: colors.surface,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGrad: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  titleOn: { color: colors.primary },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  badgeTxt: { fontSize: 9, fontWeight: '900', color: colors.primary },
  body: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
});
