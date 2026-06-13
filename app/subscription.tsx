/**
 * Subscription tiers — FREE / SILVER / GOLD / PLATINUM with Flutterwave checkout.
 */
import { Screen } from '@/components/Screen';
import { BillingCycleToggle } from '@/components/subscription/BillingCycleToggle';
import { MembershipHero } from '@/components/subscription/MembershipHero';
import { SubscriptionTierCard } from '@/components/subscription/SubscriptionTierCard';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  hasActiveGoldTrial,
  hasActiveSilverTrial,
  hasLegacyPremium,
  resolveClientEffectiveTier,
  trialDaysRemaining,
} from '@/lib/subscription/effectiveTier';
import { tierDisplayName } from '@/lib/subscription/featureLabels';
import {
  type BillingCycle,
  type PaidTier,
  type SubscriptionTier,
} from '@/lib/subscription/pricing';
import { invalidatePermissionCache } from '@/lib/subscription/checkPermission';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const TIERS: SubscriptionTier[] = ['FREE', 'SILVER', 'GOLD', 'PLATINUM'];

function tierRank(t: SubscriptionTier): number {
  return { FREE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 }[t];
}

export default function SubscriptionScreen() {
  const { user, dbUser, refreshProfile } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [busyTier, setBusyTier] = useState<PaidTier | null>(null);
  const [goldTrialBusy, setGoldTrialBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [goldTrialSuccess, setGoldTrialSuccess] = useState(false);

  const effective = resolveClientEffectiveTier(dbUser);
  const paidTier = dbUser?.subscription_tier ?? 'FREE';
  const paidActive =
    paidTier !== 'FREE' &&
    !!dbUser?.subscription_expires_at &&
    new Date(dbUser.subscription_expires_at).getTime() > Date.now();

  const silverTrialDays = trialDaysRemaining(dbUser?.silver_trial_expires_at);
  const goldTrialDays = trialDaysRemaining(dbUser?.gold_trial_expires_at);

  const goldTrialEligible =
    !!dbUser?.has_been_silver_subscriber &&
    paidTier === 'SILVER' &&
    paidActive &&
    !dbUser.gold_trial_activated_at;

  const legacyPremiumActive = hasLegacyPremium(dbUser);

  const startCheckout = useCallback(
    async (tier: PaidTier) => {
      if (!user?.id || !isSupabaseConfigured) return;
      setBusyTier(tier);
      try {
        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: { user_id: user.id, tier, billing_cycle: cycle },
        });
        if (error) throw error;
        const link = (data as { payment_link?: string })?.payment_link;
        if (!link) throw new Error('No payment link returned');
        await WebBrowser.openBrowserAsync(link);
      } catch (e) {
        Alert.alert('Checkout', e instanceof Error ? e.message : 'Could not start checkout');
      } finally {
        setBusyTier(null);
      }
    },
    [user?.id, cycle]
  );

  const onSubscribe = useCallback(
    (tier: PaidTier) => {
      if (!user?.id || !isSupabaseConfigured) return;
      if (paidActive && paidTier === tier) {
        Alert.alert('Current plan', 'You are already on this plan.');
        return;
      }

      const switchingDown =
        paidActive && tierRank(tier) < tierRank(paidTier as SubscriptionTier);
      const switchingUp =
        paidActive && tierRank(tier) > tierRank(paidTier as SubscriptionTier);

      if (switchingDown || switchingUp) {
        const fromName = tierDisplayName(paidTier as SubscriptionTier);
        const toName = tierDisplayName(tier);
        Alert.alert(
          switchingDown ? 'Switch to a lower plan' : 'Upgrade plan',
          switchingDown
            ? `Checkout will move you from ${fromName} to ${toName}. Your current plan stays active until the switch completes.`
            : `Checkout will upgrade you from ${fromName} to ${toName}.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Continue', onPress: () => void startCheckout(tier) },
          ]
        );
        return;
      }

      void startCheckout(tier);
    },
    [user?.id, paidActive, paidTier, startCheckout]
  );

  const onCancelSubscription = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured || !paidActive) return;
    setCancelBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { user_id: user.id },
      });
      if (error) throw error;
      invalidatePermissionCache();
      await refreshProfile();
      const until = (data as { access_until?: string })?.access_until;
      Alert.alert(
        'Subscription cancelled',
        until
          ? `You'll keep ${tierDisplayName(paidTier as SubscriptionTier)} until ${new Date(until).toLocaleDateString()}.`
          : 'Auto-renew is off. Your current plan stays active until the billing period ends.'
      );
    } catch (e) {
      Alert.alert('Cancellation', e instanceof Error ? e.message : 'Could not cancel subscription');
    } finally {
      setCancelBusy(false);
    }
  }, [user?.id, paidActive, paidTier, refreshProfile]);

  const onActivateGoldTrial = useCallback(async () => {
    if (!goldTrialEligible) return;
    setGoldTrialBusy(true);
    try {
      const { error } = await supabase.functions.invoke('activate-gold-trial', { body: {} });
      if (error) throw error;
      invalidatePermissionCache();
      await refreshProfile();
      setGoldTrialSuccess(true);
    } catch (e) {
      Alert.alert('Trial', e instanceof Error ? e.message : 'Could not activate trial');
    } finally {
      setGoldTrialBusy(false);
    }
  }, [goldTrialEligible, refreshProfile]);

  function ctaForTier(tier: SubscriptionTier) {
    if (tier === 'FREE') {
      if (paidActive) {
        return {
          label: 'Cancel at period end',
          disabled: cancelBusy,
          action: () => {
            Alert.alert(
              'Cancel subscription?',
              `You'll keep ${tierDisplayName(paidTier as SubscriptionTier)} until your billing period ends, then return to Free.`,
              [
                { text: 'Keep plan', style: 'cancel' },
                { text: 'Cancel renewal', style: 'destructive', onPress: () => void onCancelSubscription() },
              ]
            );
          },
          variant: 'ghost' as const,
        };
      }
      return {
        label: effective === 'FREE' && !hasActiveSilverTrial(dbUser) ? 'Current plan' : 'Free tier',
        disabled: true,
        variant: 'ghost' as const,
      };
    }
    const paid = tier as PaidTier;
    if (paidActive && paidTier === tier) {
      return { label: 'Current plan', disabled: true, variant: 'ghost' as const };
    }
    if (tier === 'SILVER' && hasActiveSilverTrial(dbUser) && !paidActive) {
      return { label: `Trial — ${silverTrialDays}d left`, disabled: true, variant: 'ghost' as const };
    }
    if (tier === 'GOLD' && hasActiveGoldTrial(dbUser)) {
      return { label: `Trial — ${goldTrialDays}d left`, disabled: true, variant: 'ghost' as const };
    }
    if (tier === 'GOLD' && goldTrialEligible) {
      return {
        label: 'Try Gold free for 7 days',
        disabled: goldTrialBusy,
        action: () => void onActivateGoldTrial(),
        variant: 'primary' as const,
      };
    }

    const isDowngrade = paidActive && tierRank(tier) < tierRank(paidTier as SubscriptionTier);
    const isUpgrade = tierRank(tier) > tierRank(effective);

    return {
      label: isDowngrade
        ? `Switch to ${tierDisplayName(tier)}`
        : isUpgrade
          ? 'Upgrade'
          : 'Subscribe',
      disabled: busyTier === paid,
      action: () => onSubscribe(paid),
      variant: 'primary' as const,
    };
  }

  function trialNoteForTier(tier: SubscriptionTier): string | null {
    if (tier === 'SILVER' && hasActiveSilverTrial(dbUser) && !paidActive) {
      return `Silver trial — ${silverTrialDays} days remaining`;
    }
    return null;
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.root}>
      <LinearGradient
        colors={[colors.discoveryGradientMid, colors.discoveryGradientBottom, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.nav}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navKicker}>Plans & billing</Text>
          <Text style={styles.navTitle}>Membership</Text>
        </View>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MembershipHero
          effective={effective}
          dbUser={dbUser}
          paidActive={!!paidActive}
          silverTrialDays={silverTrialDays ?? 0}
          goldTrialDays={goldTrialDays ?? 0}
        />

        {legacyPremiumActive && effective !== 'FREE' && paidTier === 'FREE' ? (
          <View style={styles.legacyPremiumCard}>
            <Text style={styles.legacyPremiumTitle}>Legacy premium active</Text>
            <Text style={styles.legacyPremiumDesc}>
              You have legacy premium access until{' '}
              {new Date(dbUser!.premium_until!).toLocaleDateString(undefined, { dateStyle: 'medium' })},
              giving you Silver-equivalent benefits. Subscribe to a current plan for continued access after this
              date.
            </Text>
          </View>
        ) : null}

        {goldTrialSuccess ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.successBannerTxt}>
              Gold trial activated — head to Discover to explore!
            </Text>
          </View>
        ) : null}

        <BillingCycleToggle value={cycle} onChange={setCycle} />

        <Text style={styles.sectionLabel}>Choose your tier</Text>

        {TIERS.map((tier, index) => {
          const isCurrent = effective === tier || (paidActive && paidTier === tier);
          return (
            <SubscriptionTierCard
              key={tier}
              tier={tier}
              cycle={cycle}
              isCurrent={isCurrent}
              isPopular={tier === 'GOLD'}
              cta={ctaForTier(tier)}
              loading={
                (tier !== 'FREE' && busyTier === tier) ||
                (tier === 'GOLD' && goldTrialBusy) ||
                (tier === 'FREE' && cancelBusy)
              }
              trialNote={trialNoteForTier(tier)}
              index={index}
            />
          );
        })}

        <View style={styles.trustRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <Text style={styles.trustTxt}>Secure checkout powered by Flutterwave</Text>
        </View>

        <Pressable style={styles.historyLink} onPress={() => router.push('/subscription/history')}>
          <Text style={styles.historyLinkText}>View subscription history</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  backPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  navCenter: { flex: 1, alignItems: 'center' },
  navKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  navTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  navSpacer: { width: 42 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  trustTxt: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  legacyPremiumCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  legacyPremiumTitle: { fontSize: 15, fontWeight: '900', color: colors.text, marginBottom: 6 },
  legacyPremiumDesc: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successBannerTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: '#047857' },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 4,
    paddingVertical: spacing.sm,
  },
  historyLinkText: { fontSize: 16, fontWeight: '800', color: colors.primary },
});
