import { colors, radius, spacing } from '@/constants/theme';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  tier: SubscriptionTier;
  compact?: boolean;
};

const TIER_STYLES: Record<
  Exclude<SubscriptionTier, 'FREE'>,
  { colors: [string, string]; label: string; border?: string }
> = {
  SILVER: { colors: ['#C0C5CE', '#9CA3AF'], label: 'Silver' },
  GOLD: { colors: ['#F5D76E', '#D4A017'], label: 'Gold' },
  PLATINUM: { colors: ['#E8EAF6', '#7C4DFF'], label: 'Platinum', border: '#5E35B1' },
};

export function TierBadge({ tier, compact }: Props) {
  if (tier === 'FREE') return null;

  const style = TIER_STYLES[tier];
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style.border && { borderColor: style.border, borderWidth: 1 }]}>
      <LinearGradient colors={style.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
        <Text style={[styles.label, compact && styles.labelCompact]}>{style.label}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  wrapCompact: { transform: [{ scale: 0.9 }] },
  grad: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelCompact: { fontSize: 9 },
});
