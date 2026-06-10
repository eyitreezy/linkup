import { TierBadge } from '@/components/TierBadge';
import { TIER_THEME } from '@/components/subscription/tierTheme';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { tierDisplayName } from '@/lib/subscription/featureLabels';
import {
  type BillingCycle,
  type PaidTier,
  PRICING,
  TIER_FEATURES,
  type SubscriptionTier,
} from '@/lib/subscription/pricing';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type TierCta = {
  label: string;
  disabled: boolean;
  action?: () => void;
  variant?: 'primary' | 'ghost';
};

type Props = {
  tier: SubscriptionTier;
  cycle: BillingCycle;
  isCurrent: boolean;
  isPopular?: boolean;
  cta: TierCta;
  loading?: boolean;
  trialNote?: string | null;
  index?: number;
};

function parsePrice(tier: SubscriptionTier, cycle: BillingCycle) {
  if (tier === 'FREE') return { amount: '0', currency: 'NGN', period: null as string | null };
  const price = PRICING[tier as PaidTier][cycle];
  const match = price.label.match(/^NGN\s([\d,]+)\/(\w+)$/);
  return {
    amount: match?.[1] ?? price.label,
    currency: 'NGN',
    period: match?.[2] ?? null,
    saving: 'saving' in price ? price.saving : null,
  };
}

export function SubscriptionTierCard({
  tier,
  cycle,
  isCurrent,
  isPopular,
  cta,
  loading,
  trialNote,
  index = 0,
}: Props) {
  const theme = TIER_THEME[tier];
  const price = parsePrice(tier, cycle);
  const showGradientCta = cta.variant !== 'ghost' && !cta.disabled && tier !== 'FREE';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320, delay: index * 60 }}
    >
      <LinearGradient
        colors={isCurrent || isPopular ? [...theme.ring] : ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ring, isCurrent && styles.ringCurrent]}
      >
        <View style={styles.card}>
          <View style={styles.topRow}>
            <LinearGradient
              colors={
                tier === 'PLATINUM'
                  ? ['#E8EAF6', '#7C4DFF']
                  : tier === 'GOLD'
                    ? ['#FEF3C7', '#F59E0B']
                    : tier === 'SILVER'
                      ? ['#F3F4F6', '#9CA3AF']
                      : ['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.1)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGrad}
            >
              <Ionicons
                name={theme.icon}
                size={22}
                color={tier === 'FREE' ? colors.primary : colors.text}
              />
            </LinearGradient>

            <View style={styles.titleCol}>
              <View style={styles.nameRow}>
                <Text style={styles.tierName}>{tierDisplayName(tier)}</Text>
                {tier !== 'FREE' ? <TierBadge tier={tier} compact /> : null}
              </View>
              <Text style={styles.tagline}>{theme.tagline}</Text>
            </View>

            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeTxt}>Current</Text>
              </View>
            ) : isPopular ? (
              <View style={styles.popularBadge}>
                <Ionicons name="flame" size={12} color="#fff" />
                <Text style={styles.popularBadgeTxt}>Popular</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.currency}>{price.currency}</Text>
            <Text style={styles.amount}>{price.amount}</Text>
            {price.period ? <Text style={styles.period}>/{price.period}</Text> : null}
          </View>
          {price.saving ? <Text style={styles.saving}>{price.saving}</Text> : null}
          {trialNote ? <Text style={styles.trialNote}>{trialNote}</Text> : null}

          <View style={styles.divider} />

          <View style={styles.featureList}>
            {TIER_FEATURES[tier].map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={[styles.checkWrap, { backgroundColor: `${theme.accent}18` }]}>
                  <Ionicons name="checkmark" size={12} color={theme.accent} />
                </View>
                <Text style={styles.featureTxt}>{feature}</Text>
              </View>
            ))}
          </View>

          <Pressable
            disabled={cta.disabled || loading}
            onPress={cta.action}
            style={({ pressed }) => [
              showGradientCta ? styles.ctaOuter : styles.ctaPlain,
              cta.disabled && styles.ctaDisabled,
              pressed && !cta.disabled && !loading && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={cta.label}
          >
            {showGradientCta ? (
              <LinearGradient
                colors={[...APP_CTA_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGrad}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaTxt}>{cta.label}</Text>
                )}
              </LinearGradient>
            ) : loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.ctaTxtPlain, cta.disabled && styles.ctaTxtDisabled]}>{cta.label}</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  ring: { borderRadius: radius.xl + 2, padding: 2, marginBottom: spacing.md },
  ringCurrent: { padding: 2.5 },
  card: {
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  iconGrad: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tierName: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  tagline: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  currentBadgeTxt: { fontSize: 10, fontWeight: '900', color: colors.primary, letterSpacing: 0.4 },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: colors.secondary,
  },
  popularBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  currency: { fontSize: 14, fontWeight: '800', color: colors.textMuted, marginBottom: 4 },
  amount: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  period: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: 5 },
  saving: { fontSize: 13, fontWeight: '800', color: colors.success, marginTop: 4 },
  trialNote: { fontSize: 13, fontWeight: '700', color: colors.secondary, marginTop: spacing.xs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  featureList: { gap: spacing.sm, marginBottom: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 },
  ctaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  ctaGrad: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  ctaPlain: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.18)',
  },
  ctaDisabled: { opacity: 0.55 },
  ctaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  ctaTxt: { fontSize: 16, fontWeight: '900', color: '#fff' },
  ctaTxtPlain: { fontSize: 16, fontWeight: '800', color: colors.primary },
  ctaTxtDisabled: { color: colors.textMuted },
});
