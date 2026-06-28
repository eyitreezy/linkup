/**
 * Subscription tiers — FREE / SILVER / GOLD / PLATINUM with Flutterwave checkout.
 */
import { Screen } from '@/components/Screen';
import { BillingCycleToggle } from '@/components/subscription/BillingCycleToggle';
import { MembershipHero } from '@/components/subscription/MembershipHero';
import { SubscriptionTierCard } from '@/components/subscription/SubscriptionTierCard';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { AppFeedbackModal } from '@/components/ui/AppFeedbackModal';
import { FlutterwaveCheckoutModal } from '@/components/checkout/FlutterwaveCheckoutModal';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useFlutterwaveCheckout } from '@/hooks/useFlutterwaveCheckout';
import { getSubscriptionCallbackUrl } from '@/lib/flutterwave/callbackUrl';
import {
  getInvokeErrorMessage,
  parsePaymentLinkFromInvoke,
  userFacingCheckoutError,
} from '@/lib/flutterwave/parsePaymentLink';
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
import { tierRank } from '@/lib/subscription/tierRank';
import { invalidatePermissionCache } from '@/lib/subscription/checkPermission';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type FeedbackState = {
  title: string;
  message: string;
  variant: 'success' | 'error' | 'warning';
};

const TIERS: SubscriptionTier[] = ['FREE', 'SILVER', 'GOLD', 'PLATINUM'];

export default function SubscriptionScreen() {
  const { user, dbUser, refreshProfile } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [busyTier, setBusyTier] = useState<PaidTier | null>(null);
  const [goldTrialBusy, setGoldTrialBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [goldTrialSuccess, setGoldTrialSuccess] = useState(false);
  const [checkoutConfirm, setCheckoutConfirm] = useState<{
    tier: PaidTier;
    switchingDown: boolean;
    fromName: string;
    toName: string;
  } | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const { session: checkoutSession, beginCheckout, dismissCheckout } = useFlutterwaveCheckout();

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

  const showFeedback = useCallback((next: FeedbackState) => {
    setFeedback(next);
  }, []);

  const startCheckout = useCallback(
    async (tier: PaidTier): Promise<boolean> => {
      if (!user?.id || !isSupabaseConfigured) return false;
      setBusyTier(tier);
      try {
        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: {
            user_id: user.id,
            tier,
            billing_cycle: cycle,
            redirect_url: getSubscriptionCallbackUrl(),
          },
        });
        if (error) {
          throw new Error(await getInvokeErrorMessage(error, data));
        }

        const link = parsePaymentLinkFromInvoke(data);
        if (!link) {
          throw new Error((await getInvokeErrorMessage(null, data)) || 'No payment link returned');
        }

        const opened = await beginCheckout(link, getSubscriptionCallbackUrl());
        if (!opened.ok) throw new Error(opened.error ?? 'Could not open checkout');
        if (opened.mode === 'browser') {
          setBusyTier(null);
          invalidatePermissionCache();
          await refreshProfile();
        }
        return true;
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Could not start checkout';
        showFeedback({
          variant: 'error',
          title: 'Checkout unavailable',
          message: userFacingCheckoutError(raw),
        });
        setBusyTier(null);
        return false;
      }
    },
    [user?.id, cycle, beginCheckout, showFeedback, refreshProfile]
  );

  const handleDismissCheckout = useCallback(() => {
    dismissCheckout();
    setBusyTier(null);
  }, [dismissCheckout]);

  const onSubscribe = useCallback(
    (tier: PaidTier) => {
      if (!user?.id || !isSupabaseConfigured) return;
      if (paidActive && paidTier === tier) {
        showFeedback({
          variant: 'warning',
          title: 'Already on this plan',
          message: `You're already subscribed to ${tierDisplayName(tier)}.`,
        });
        return;
      }

      const switchingDown =
        paidActive && tierRank(tier) < tierRank(paidTier as SubscriptionTier);
      const switchingUp =
        paidActive && tierRank(tier) > tierRank(paidTier as SubscriptionTier);

      if (switchingDown || switchingUp) {
        const fromName = tierDisplayName(paidTier as SubscriptionTier);
        const toName = tierDisplayName(tier);
        setCheckoutConfirm({ tier, switchingDown, fromName, toName });
        return;
      }

      void startCheckout(tier);
    },
    [user?.id, paidActive, paidTier, startCheckout, showFeedback]
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
      showFeedback({
        variant: 'success',
        title: 'Subscription cancelled',
        message: until
          ? `You'll keep ${tierDisplayName(paidTier as SubscriptionTier)} until ${new Date(until).toLocaleDateString()}.`
          : 'Auto-renew is off. Your current plan stays active until the period ends.',
      });
    } catch (e) {
      showFeedback({
        variant: 'error',
        title: 'Cancellation failed',
        message: e instanceof Error ? e.message : 'Could not cancel subscription',
      });
    } finally {
      setCancelBusy(false);
    }
  }, [user?.id, paidActive, paidTier, refreshProfile, showFeedback]);

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
      showFeedback({
        variant: 'error',
        title: 'Trial unavailable',
        message: e instanceof Error ? e.message : 'Could not activate trial',
      });
    } finally {
      setGoldTrialBusy(false);
    }
  }, [goldTrialEligible, refreshProfile, showFeedback]);

  function ctaForTier(tier: SubscriptionTier) {
    if (tier === 'FREE') {
      if (paidActive) {
        return {
          label: 'Cancel at period end',
          disabled: cancelBusy,
          action: () => setCancelConfirmOpen(true),
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
          <Ionicons name="lock-closed-outline" size={16} color="#D97706" />
          <Text style={styles.trustTxt}>Secure checkout powered by Flutterwave</Text>
        </View>

        <Pressable style={styles.historyLink} onPress={() => router.push('/subscription/history')}>
          <Text style={styles.historyLinkText}>View subscription history</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </ScrollView>

      <AppConfirmModal
        visible={checkoutConfirm != null}
        onClose={() => setCheckoutConfirm(null)}
        kicker="Membership"
        title={checkoutConfirm?.switchingDown ? 'Switch to a lower plan' : 'Upgrade plan'}
        message={
          checkoutConfirm?.switchingDown
            ? `Checkout will move you from ${checkoutConfirm.fromName} to ${checkoutConfirm.toName}. Your current plan stays active until the switch completes.`
            : `Checkout will upgrade you from ${checkoutConfirm?.fromName ?? ''} to ${checkoutConfirm?.toName ?? ''}.`
        }
        iconVariant={checkoutConfirm?.switchingDown ? 'warning' : 'boost'}
        primaryLabel="Not now"
        onPrimary={() => setCheckoutConfirm(null)}
        secondaryLabel="Continue"
        onSecondary={async () => {
          const tier = checkoutConfirm?.tier;
          if (!tier) return;
          const ok = await startCheckout(tier);
          if (ok) setCheckoutConfirm(null);
        }}
        busyOn="secondary"
      />

      <AppConfirmModal
        visible={cancelConfirmOpen}
        onClose={() => !cancelBusy && setCancelConfirmOpen(false)}
        kicker="Membership"
        title="Cancel subscription?"
        message={`You'll keep ${tierDisplayName(paidTier as SubscriptionTier)} until your billing period ends, then return to Free.`}
        iconVariant="warning"
        primaryLabel="Keep plan"
        onPrimary={() => setCancelConfirmOpen(false)}
        secondaryLabel="Cancel renewal"
        onSecondary={async () => {
          await onCancelSubscription();
          setCancelConfirmOpen(false);
        }}
        secondaryTone="danger"
        busyOn="secondary"
        dismissOnBackdrop={!cancelBusy}
      />

      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        kicker="Membership"
        variant={feedback?.variant ?? 'warning'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
      />

      <FlutterwaveCheckoutModal
        visible={checkoutSession != null}
        url={checkoutSession?.url ?? null}
        returnUrl={checkoutSession?.returnUrl ?? null}
        onDismiss={handleDismissCheckout}
        onSuccess={() => {
          handleDismissCheckout();
          router.push('/subscription/callback' as Href);
        }}
        title="LinkUp membership"
      />
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
    borderColor: 'rgba(94, 82, 255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  backPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 18, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.2 },
  navSpacer: { width: 42 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
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
  trustTxt: { fontSize: 13, fontWeight: '600',
    fontFamily: fonts.medium, color: '#D97706' },
  legacyPremiumCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  legacyPremiumTitle: { fontSize: 15, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, marginBottom: 6 },
  legacyPremiumDesc: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19, fontFamily: fonts.medium, },
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
  successBannerTxt: { flex: 1, fontSize: 14, fontWeight: '700',
    fontFamily: fonts.medium, color: '#047857' },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 4,
    paddingVertical: spacing.sm,
  },
  historyLinkText: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
});
