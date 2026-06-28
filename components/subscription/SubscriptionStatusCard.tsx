import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { deriveSubscriptionState } from '@/lib/subscription/deriveState';
import { TIER_META, TIER_UPGRADE_BULLETS, tierShortBadge } from '@/lib/subscription/tierMeta';
import { PRICING, type PaidTier, type SubscriptionTier } from '@/lib/subscription/pricing';
import type { DbUser } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type CardVariant = 'free' | 'trial' | 'paid';

type ShellProps = {
  onPress: () => void;
  variant: CardVariant;
  tier?: SubscriptionTier;
  trialTier?: 'silver' | 'gold';
  title: string;
  subtitle: string;
  cta: string;
  pills?: string[];
};

function TierPill({ tier, trial }: { tier?: SubscriptionTier; trial?: boolean }) {
  if (!tier || tier === 'FREE') {
    return (
      <View style={[styles.badge, { backgroundColor: TIER_META.FREE.badgeBg }]}>
        <Text style={[styles.badgeTxt, { color: TIER_META.FREE.badgeText }]}>Current plan</Text>
      </View>
    );
  }

  const meta = TIER_META[tier];
  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, { backgroundColor: meta.badgeBg }]}>
        <Text style={[styles.badgeTxt, { color: meta.badgeText }]}>{tierShortBadge(tier)}</Text>
      </View>
      {trial ? <Text style={styles.trialKicker}>Trial</Text> : null}
    </View>
  );
}

function FeaturePills({ labels }: { labels: string[] }) {
  return (
    <View style={styles.pillRow}>
      {labels.slice(0, 3).map((label) => (
        <View key={label} style={styles.pill}>
          <Text style={styles.pillTxt}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function SubscriptionStatusCardShell({
  onPress,
  variant,
  tier,
  trialTier,
  title,
  subtitle,
  cta,
  pills,
}: ShellProps) {
  const isFree = variant === 'free';
  const isTrial = variant === 'trial';
  const paidTier = tier && tier !== 'FREE' ? tier : null;
  const displayTier =
    isTrial && trialTier ? (trialTier === 'gold' ? 'GOLD' : 'SILVER') : paidTier ?? 'FREE';
  const meta = TIER_META[displayTier];
  const borderColors = isFree ? ([...APP_CTA_GRADIENT, APP_CTA_GRADIENT[1]] as const) : meta.borderGradient;
  const innerColors = isFree ? TIER_META.FREE.innerBg : meta.innerBg;
  const iconColors = isFree || isTrial || paidTier === 'SILVER' || paidTier === 'PLATINUM'
    ? APP_CTA_GRADIENT
    : meta.iconGradient;
  const ctaColors =
    isFree || isTrial || paidTier === 'SILVER' || paidTier === 'PLATINUM'
      ? APP_CTA_GRADIENT
      : meta.ctaGradient;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={cta}
    >
      <LinearGradient colors={[...borderColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.border}>
        <LinearGradient colors={innerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inner}>
          <View style={[styles.decorCircle, styles.decorTop]} />
          <View style={[styles.decorCircle, styles.decorBottom]} />

          <View style={styles.topBlock}>
            <View style={styles.mainRow}>
              <LinearGradient colors={[...iconColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconShell}>
                <Ionicons
                  name={isTrial ? 'sparkles' : 'diamond-outline'}
                  size={24}
                  color="#fff"
                />
              </LinearGradient>

              <View style={styles.textCol}>
                <TierPill
                  tier={isFree ? undefined : displayTier}
                  trial={isTrial}
                />
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              <View style={styles.ctaOuter}>
                <LinearGradient colors={[...ctaColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
                  <Text style={styles.ctaTxt}>{cta}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#fff" />
                </LinearGradient>
              </View>
            </View>
          </View>

          {pills && pills.length > 0 ? (
            <View style={styles.perksBlock}>
              <Text style={styles.perksLabel}>{isFree ? 'Unlock with Silver+' : 'Your perks'}</Text>
              <FeaturePills labels={pills} />
            </View>
          ) : null}
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

type Props = {
  dbUser: DbUser | null | undefined;
  onPress: () => void;
};

function priceLine(tier: PaidTier, billingCycle: 'monthly' | 'annual' | null): string {
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  const price = PRICING[tier][cycle];
  return cycle === 'annual' ? `${price.label.replace('/year', '/yr')}` : price.label;
}

function formatRenewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SubscriptionStatusCard({ dbUser, onPress }: Props) {
  const state = deriveSubscriptionState(dbUser);
  const {
    tier,
    effectiveTier,
    billingCycle,
    expiresAt,
    legacyPremiumUntil,
    isTrialActive,
    trialDaysRemaining,
    isPaidActive,
    isLegacyPremiumActive,
    trialType,
  } = state;

  if (isTrialActive && !isPaidActive) {
    const trialTierKey = trialType === 'gold' ? 'GOLD' : 'SILVER';
    const trialMeta = TIER_META[trialTierKey];
    return (
      <SubscriptionStatusCardShell
        onPress={onPress}
        variant="trial"
        trialTier={trialType ?? 'silver'}
        title={`${trialMeta.label} trial`}
        subtitle={`${trialDaysRemaining ?? 0} day${trialDaysRemaining === 1 ? '' : 's'} remaining · No charge until you upgrade`}
        cta="Upgrade now"
        pills={TIER_UPGRADE_BULLETS[trialTierKey].slice(0, 3)}
      />
    );
  }

  if (isPaidActive && tier !== 'FREE') {
    const meta = TIER_META[tier];
    const price = priceLine(tier, billingCycle);
    const renews = expiresAt ? formatRenewDate(expiresAt) : null;

    return (
      <SubscriptionStatusCardShell
        onPress={onPress}
        variant="paid"
        tier={tier}
        title={meta.label}
        subtitle={[price, renews ? `Renews ${renews}` : ''].filter(Boolean).join(' · ')}
        cta="Manage plan"
        pills={TIER_UPGRADE_BULLETS[tier].slice(0, 3)}
      />
    );
  }

  if (isLegacyPremiumActive && effectiveTier !== 'FREE') {
    const meta = TIER_META[effectiveTier];
    const renews = legacyPremiumUntil ? formatRenewDate(legacyPremiumUntil) : null;
    const price = priceLine(effectiveTier, 'monthly');

    return (
      <SubscriptionStatusCardShell
        onPress={onPress}
        variant="paid"
        tier={effectiveTier}
        title={meta.label}
        subtitle={[price, renews ? `Renews ${renews}` : 'Legacy premium active'].filter(Boolean).join(' · ')}
        cta="Manage plan"
        pills={TIER_UPGRADE_BULLETS[effectiveTier].slice(0, 3)}
      />
    );
  }

  return (
    <SubscriptionStatusCardShell
      onPress={onPress}
      variant="free"
      title={TIER_META.FREE.label}
      subtitle="Upgrade to unlock bookmarks, advanced filters, plan boosts, and more."
      cta="See plans"
      pills={TIER_UPGRADE_BULLETS.SILVER.slice(0, 3)}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  pressed: { opacity: 0.98, transform: [{ scale: 0.99 }] },
  border: { borderRadius: 22, padding: 2 },
  inner: {
    borderRadius: 20,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  decorTop: {
    width: 112,
    height: 112,
    top: -40,
    right: -40,
  },
  decorBottom: {
    width: 80,
    height: 80,
    bottom: -24,
    left: '22%',
    backgroundColor: 'rgba(255, 74, 114, 0.1)',
  },
  topBlock: { gap: spacing.md },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  textCol: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.button,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trialKicker: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
  },
  ctaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    flexShrink: 0,
    maxWidth: 132,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  ctaGrad: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ctaTxt: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  perksBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.12)',
  },
  perksLabel: {
    marginBottom: spacing.sm,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillTxt: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: 'rgba(26, 29, 38, 0.85)',
  },
});
