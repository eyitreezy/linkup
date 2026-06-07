/**
 * PL6a — Agreement & confirmation after offer accept (trust + structured summary + CTAs).
 */
import { CancellationSummaryCard } from '@/components/plans/CancellationSummaryCard';
import { PlanAgreementCTAButton } from '@/components/plans/agreement/PlanAgreementCTAButton';
import { PlanAgreementStatusBadge } from '@/components/plans/agreement/PlanAgreementStatusBadge';
import { PlanAgreementUserHeader, type AgreementParty } from '@/components/plans/agreement/PlanAgreementUserHeader';
import { PreAgreementFullscreenModal } from '@/components/plans/agreement/PreAgreementFullscreenModal';
import { PlanConfirmationModal } from '@/components/plans/agreement/PlanConfirmationModal';
import { AgreementPaymentPreviewCard } from '@/components/plans/agreement/AgreementPaymentPreviewCard';
import { MeetupFundingReminderBanner } from '@/components/plans/agreement/MeetupFundingReminderBanner';
import { PlanSummaryCard } from '@/components/plans/agreement/PlanSummaryCard';
import { DiscoveryGradientBg } from '@/components/ui/DiscoveryGradientBg';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import {
  getAgreementPaymentPreview,
  isMeetupWithinHours,
} from '@/lib/escrow/escrowPaymentPreview';
import { confirmFreePlan, proceedToSecurePayment } from '@/lib/plans/planAgreementActions';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { goToDiscoveryFeed } from '@/lib/navigation/goToDiscoveryFeed';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function agreedPriceLabel(plan: DbPlan, offer: DbPlanOffer | null): string {
  const cents = plan.agreed_price_cents ?? offer?.amount_cents ?? plan.starting_price_cents;
  if (cents == null || cents <= 0) return 'Free plan';
  return `${(cents / 100).toFixed(0)} ${plan.currency}`;
}

function formatOfferExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function AgreementTopNav({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.topNav, { paddingTop: Math.max(topInset, spacing.xs) }]}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={() => goToDiscoveryFeed()}
        style={({ pressed }) => [styles.feedTopBtn, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go to discovery feed"
      >
        <Text style={styles.feedTopLabel}>Feed</Text>
      </Pressable>
    </View>
  );
}

export default function PlanAgreementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, dbUser } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [offer, setOffer] = useState<DbPlanOffer | null>(null);
  const [hostParty, setHostParty] = useState<AgreementParty | null>(null);
  const [guestParty, setGuestParty] = useState<AgreementParty | null>(null);
  /** False until the current `load()` finishes — avoids flashing “no offer” while `plan` is set but `offer` is still fetching (React commits between awaits). */
  const [loadDone, setLoadDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [confirmationUserIds, setConfirmationUserIds] = useState<string[]>([]);
  const [legalGateOpen, setLegalGateOpen] = useState(false);
  const [pendingLegal, setPendingLegal] = useState<'free' | 'pay' | 'ack' | null>(null);
  const [legalBusy, setLegalBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

  const userConfirmed = useMemo(
    () => !!(user?.id && confirmationUserIds.includes(user.id)),
    [confirmationUserIds, user?.id]
  );
  const bothConfirmed = useMemo(() => new Set(confirmationUserIds).size >= 2, [confirmationUserIds]);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) {
      setLoadDone(true);
      return;
    }
    setLoadDone(false);
    try {
      const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
      if (!p) {
        setPlan(null);
        setOffer(null);
        setHostParty(null);
        setGuestParty(null);
        setConfirmationUserIds([]);
        return;
      }
      const pl = p as DbPlan;

      let off: DbPlanOffer | null = null;
      if (pl.accepted_offer_id) {
        const { data: o } = await supabase.from('plan_offers').select('*').eq('id', pl.accepted_offer_id).single();
        if (o) off = o as DbPlanOffer;
      }

      const bidderId = off?.bidder_id ?? pl.creator_id;

      const [{ data: hp }, { data: bp }, { data: confRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, verified_badge')
          .eq('user_id', pl.creator_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, verified_badge')
          .eq('user_id', bidderId)
          .maybeSingle(),
        supabase.from('agreement_confirmations').select('user_id').eq('plan_id', pl.id),
      ]);

      setConfirmationUserIds((confRows ?? []).map((r) => r.user_id as string));

      // Apply plan + offer + parties in one commit so we never render “accepted id set, offer null”.
      setPlan(pl);
      setOffer(off);
      if (hp) {
        setHostParty({
          userId: hp.user_id,
          name: hp.display_name ?? 'Host',
          avatarUrl: hp.avatar_url,
          verified: !!hp.verified_badge,
        });
      } else setHostParty(null);
      if (bp) {
        setGuestParty({
          userId: bp.user_id,
          name: bp.display_name ?? 'Guest',
          avatarUrl: bp.avatar_url,
          verified: !!bp.verified_badge,
        });
      } else setGuestParty(null);
    } finally {
      setLoadDone(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!user) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <View style={[styles.center, { paddingTop: insets.top }]}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </View>
      </Screen>
    );
  }

  if (!loadDone) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <View style={[styles.center, { paddingTop: insets.top }]}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </View>
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <AgreementTopNav topInset={insets.top} />
          <View style={styles.fallbackPad}>
            <Text style={styles.muted}>This plan could not be loaded.</Text>
            <Pressable onPress={() => router.replace(`/plan/${id}` as Href)} style={styles.linkBtn}>
              <Text style={styles.linkTxt}>Back to plan</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  if (!plan.accepted_offer_id || !offer) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <AgreementTopNav topInset={insets.top} />
          <View style={styles.fallbackPad}>
            <Text style={styles.muted}>No accepted offer for this plan.</Text>
            <Pressable onPress={() => router.replace(`/plan/${id}` as Href)} style={styles.linkBtn}>
              <Text style={styles.linkTxt}>Back to plan</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  if (plan.status === 'cancelled') {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <AgreementTopNav topInset={insets.top} />
          <View style={styles.fallbackPad}>
            <Text style={styles.title}>Plan cancelled</Text>
            <Text style={styles.muted}>This agreement is no longer active.</Text>
          </View>
        </View>
      </Screen>
    );
  }

  // Narrow for async handlers (TS does not retain state narrowing inside nested functions).
  const planRow = plan;
  const offerRow = offer;

  const isHost = planRow.creator_id === user.id;
  const isBidder = offerRow.bidder_id === user.id;
  const participant = isHost || isBidder;

  if (!participant) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <AgreementTopNav topInset={insets.top} />
          <View style={styles.fallbackPad}>
            <Text style={styles.muted}>You don&apos;t have access to this agreement.</Text>
          </View>
        </View>
      </Screen>
    );
  }

  const paymentRequired =
    (planRow.agreed_price_cents ?? offerRow.amount_cents ?? planRow.starting_price_cents ?? 0) > 0;

  const whenLabel = formatIsoDateTime(
    planRow.agreed_scheduled_at,
    planRow.scheduled_at ?? offerRow.proposed_scheduled_at ?? undefined
  );
  const locationLabel = planRow.agreed_location ?? planRow.location_label;
  const notes = planRow.agreed_notes ?? offerRow.message ?? null;
  const priceLabel = agreedPriceLabel(planRow, offerRow);

  const awaitingPay = planRow.status === 'awaiting_payment';
  const needsConfirm = planRow.status === 'agreed';

  async function runConfirmFree() {
    if (busy) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setBusy(true);
    const { error } = await confirmFreePlan(supabase, planRow.id);
    setBusy(false);
    if (error) showFeedback('error', 'Could not confirm', error);
    else {
      await load();
      router.replace(`/plan/${planRow.id}` as Href);
    }
  }

  async function runProceedPayment() {
    if (busy) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setBusy(true);
    const res = await proceedToSecurePayment(supabase, planRow, offerRow);
    setBusy(false);
    if (res.error) {
      showFeedback('error', 'Payment setup failed', res.error);
      return;
    }
    if (res.escrowId) router.replace(`/escrow/${res.escrowId}` as Href);
  }

  function openLegalGate(action: 'free' | 'pay' | 'ack') {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setPendingLegal(action);
    setLegalGateOpen(true);
  }

  async function onLegalGateConfirm() {
    if (!user) return;
    const action = pendingLegal;
    setLegalBusy(true);
    const { error } = await supabase.rpc('record_agreement_confirmation', { p_plan_id: planRow.id });
    if (error) {
      setLegalBusy(false);
      showFeedback('error', 'Could not record confirmation', error.message);
      return;
    }
    const { data: refreshed } = await supabase.from('agreement_confirmations').select('user_id').eq('plan_id', planRow.id);
    const ids = (refreshed ?? []).map((r) => r.user_id as string);
    setConfirmationUserIds(ids);
    const complete = new Set(ids).size >= 2;
    setLegalGateOpen(false);
    setLegalBusy(false);
    setPendingLegal(null);
    if (complete) {
      if (action === 'free') await runConfirmFree();
      else if (action === 'pay' && isBidder) await runProceedPayment();
      else await load();
    } else {
      await load();
    }
  }

  async function onCancelConfirmed() {
    setCancelOpen(false);
    if (busy || !user) return;
    setBusy(true);
    try {
      if (planRow.creator_id === user.id) {
        await supabase
          .from('plan_offers')
          .update({ status: 'superseded' })
          .eq('plan_id', planRow.id)
          .in('status', ['pending', 'countered']);
      }
      const { error: rpcErr } = await supabase.rpc('submit_plan_cancellation', {
        p_plan_id: planRow.id,
        p_no_show: false,
      });
      if (rpcErr) showFeedback('error', 'Could not cancel', rpcErr.message);
      else goToDiscoveryFeed();
    } finally {
      setBusy(false);
    }
  }

  async function onMessageCounterpart() {
    if (!user) return;
    const otherId = isHost ? offerRow.bidder_id : planRow.creator_id;
    try {
      await openDirectChat(supabase, user.id, otherId);
    } catch (e) {
      showFeedback('error', 'Chat', e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  const showMessageCta =
    planRow.status === 'agreed' ||
    planRow.status === 'awaiting_payment' ||
    planRow.status === 'active';

  let primaryLabel = 'View plan';
  let onPrimary = () => router.replace(`/plan/${planRow.id}` as Href);
  let primaryDisabled = false;

  if (planRow.status === 'active') {
    primaryLabel = 'View plan';
    onPrimary = () => router.replace(`/plan/${planRow.id}` as Href);
    primaryDisabled = false;
  } else if (awaitingPay) {
    if (isBidder) {
      primaryLabel = 'Continue to secure payment';
      onPrimary = () => void runProceedPayment();
      primaryDisabled = busy;
    } else {
      primaryLabel = 'Waiting for secure payment';
      onPrimary = () => {};
      primaryDisabled = true;
    }
  } else if (needsConfirm) {
    const otherName = isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host';
    if (!userConfirmed) {
      if (!paymentRequired) {
        primaryLabel = 'Review & confirm plan';
        onPrimary = () => openLegalGate('free');
      } else if (isBidder) {
        primaryLabel = 'Review terms & pay';
        onPrimary = () => openLegalGate('pay');
      } else {
        primaryLabel = 'Review & confirm terms';
        onPrimary = () => openLegalGate('ack');
      }
      primaryDisabled = busy || legalBusy;
    } else if (!bothConfirmed) {
      primaryLabel = `Waiting for ${otherName}`;
      onPrimary = () => {};
      primaryDisabled = true;
    } else if (!paymentRequired) {
      primaryLabel = 'Confirm plan';
      onPrimary = () => void runConfirmFree();
      primaryDisabled = busy;
    } else if (isBidder) {
      primaryLabel = 'Proceed to secure payment';
      onPrimary = () => void runProceedPayment();
      primaryDisabled = busy;
    } else {
      primaryLabel = 'Waiting for guest payment';
      onPrimary = () => {};
      primaryDisabled = true;
    }
  }

  const showCancelPlan = needsConfirm || awaitingPay;
  const counterpartDisplay = isHost ? guestParty?.name ?? 'Guest' : hostParty?.name ?? 'Host';
  const inlineMessageAndView = showMessageCta && primaryLabel === 'View plan';
  const escrowCents = paymentRequired
    ? (planRow.agreed_price_cents ?? offerRow.amount_cents ?? planRow.starting_price_cents ?? null)
    : null;

  const paymentPreview =
    paymentRequired && escrowCents != null && escrowCents > 0
      ? getAgreementPaymentPreview(planRow, offerRow.bidder_id, escrowCents, user.id)
      : null;

  const meetupIso =
    planRow.agreed_scheduled_at ?? planRow.scheduled_at ?? offerRow.proposed_scheduled_at ?? null;
  const meetupSoon =
    paymentRequired && (needsConfirm || awaitingPay) && isMeetupWithinHours(meetupIso, 48);

  let paymentPreviewVariant: 'you_pay_next' | 'counterparty_pays' | 'split_you_pay' | 'split_waiting' | null =
    null;
  if (paymentPreview) {
    if (paymentPreview.pattern === 'B') {
      paymentPreviewVariant = 'split_you_pay';
    } else if (paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'you_pay_next';
    } else {
      paymentPreviewVariant = 'counterparty_pays';
    }
  }

  const gateTitle = 'Verification required to continue';
  const gateMessage =
    'Confirming plans and sending secure payments requires a verified identity on LinkUp.';

  const leadSub = paymentRequired
    ? 'Review the summary below. Secure payment happens on the next screen — not while you negotiate.'
    : 'Review the meetup summary and confirm when you are ready.';

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <DiscoveryGradientBg />
        <VerificationHardGateModal
          visible={gateOpen}
          onClose={() => setGateOpen(false)}
          verificationStatus={dbUser?.verification_status}
          title={gateTitle}
          message={gateMessage}
        />
        <AppFeedbackModal
          visible={feedback != null}
          onClose={() => setFeedback(null)}
          variant={feedback?.variant ?? 'error'}
          title={feedback?.title ?? ''}
          message={feedback?.message ?? ''}
        />
        <PlanConfirmationModal
          visible={cancelOpen}
          title="Cancel this plan?"
          message="Are you sure you want to cancel? The other person will be notified and this agreement will end."
          confirmLabel="Cancel plan"
          cancelLabel="Keep plan"
          onCancel={() => setCancelOpen(false)}
          onConfirm={() => void onCancelConfirmed()}
        />
        <PreAgreementFullscreenModal
          visible={legalGateOpen}
          planTitle={planRow.title}
          whenLabel={whenLabel}
          locationLabel={locationLabel ?? null}
          priceLabel={priceLabel}
          escrowAmountCents={escrowCents != null && escrowCents > 0 ? escrowCents : null}
          userPaysCents={paymentPreview?.userPaysCents ?? null}
          currencyLabel={planRow.currency ?? 'NGN'}
          busy={legalBusy}
          onConfirm={() => void onLegalGateConfirm()}
        />

        <AgreementTopNav topInset={insets.top} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Agreement</Text>
              <Text style={styles.leadTitle}>Confirm plan</Text>
              <Text style={styles.leadSub}>{leadSub}</Text>
            </View>
          </View>

          {hostParty && guestParty ? (
            <View style={styles.userHeaderCard}>
              <PlanAgreementUserHeader host={hostParty} guest={guestParty} />
            </View>
          ) : null}

          <PlanAgreementStatusBadge
            primary="Offer accepted"
            secondary={
              needsConfirm
                ? bothConfirmed
                  ? 'Both confirmed — finalize in one step'
                  : userConfirmed
                    ? `Waiting for ${isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host'} to confirm`
                    : 'Review details — both people must confirm the summary'
                : awaitingPay
                  ? 'Awaiting secure payment'
                  : "You're all set"
            }
          />

          <PlanSummaryCard
            planTitle={planRow.title}
            location={locationLabel}
            whenLabel={whenLabel}
            priceLabel={priceLabel}
            notes={notes}
          />

          {meetupSoon ? (
            <MeetupFundingReminderBanner
              meetupIso={meetupIso}
              role={
                paymentPreview?.userIsPayer && (needsConfirm || awaitingPay)
                  ? 'payer'
                  : 'host_waiting'
              }
            />
          ) : null}

          {paymentPreview && paymentPreviewVariant ? (
            <AgreementPaymentPreviewCard preview={paymentPreview} variant={paymentPreviewVariant} />
          ) : null}

          <CancellationSummaryCard />

          <View style={styles.trustCard}>
            <View style={styles.trustSectionRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.trustSectionLabel}>Accepted terms</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
            <Text style={styles.trustTitle}>Both parties agreed to these details</Text>
            <Text style={styles.trustLine}>
              Accepted{' '}
              {new Date(offerRow.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
            {formatOfferExpiry(offerRow.expires_at) ? (
              <Text style={styles.trustLineMuted}>Offer window · until {formatOfferExpiry(offerRow.expires_at)}</Text>
            ) : null}
          </View>

          {inlineMessageAndView ? (
            <View style={styles.dualActionRow}>
              <Pressable
                onPress={() => void onMessageCounterpart()}
                style={({ pressed }) => [styles.dualMessageOuter, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`Message ${counterpartDisplay}`}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.dualMessageRing}
                >
                  <View style={styles.dualMessageInner}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                    <Text style={styles.dualMessageText} numberOfLines={1}>
                      Message {counterpartDisplay}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={onPrimary}
                disabled={primaryDisabled}
                style={({ pressed }) => [
                  styles.dualViewOuter,
                  primaryDisabled && { opacity: 0.55 },
                  pressed && !primaryDisabled && { opacity: 0.94, transform: [{ scale: 0.985 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="View plan details"
              >
                <LinearGradient
                  colors={
                    primaryDisabled
                      ? [colors.border, colors.border]
                      : [colors.primary, colors.secondary]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.dualViewGrad}
                >
                  <Text
                    style={[styles.dualViewText, primaryDisabled && styles.dualViewTextMuted]}
                    numberOfLines={1}
                    {...Platform.select({ android: { includeFontPadding: false } })}
                  >
                    View plan
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : showMessageCta ? (
            <Pressable
              onPress={() => void onMessageCounterpart()}
              style={({ pressed }) => [styles.messageCtaOuter, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel="Open chat with the other person"
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.messageCtaRing}
              >
                <View style={styles.messageCtaInner}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                  <Text style={styles.messageCtaText} numberOfLines={1}>
                    Message {counterpartDisplay}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          ) : null}

          {showCancelPlan || !inlineMessageAndView ? (
            <PlanAgreementCTAButton
              omitPrimary={inlineMessageAndView}
              primaryLabel={primaryLabel}
              onPrimary={onPrimary}
              primaryDisabled={primaryDisabled}
              primaryLoading={busy}
              secondaryLabel={showCancelPlan ? 'Cancel plan' : undefined}
              onSecondary={showCancelPlan ? () => setCancelOpen(true) : undefined}
              secondaryDisabled={busy}
            />
          ) : null}
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
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
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
  feedTopBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  feedTopLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.92 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  userHeaderCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fallbackPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  muted: {
    fontSize: 15,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    lineHeight: 22,
    fontWeight: '600',
  },
  linkBtn: { paddingVertical: spacing.md },
  linkTxt: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  trustSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  trustSectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
    marginBottom: spacing.sm,
  },
  trustCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  trustTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  trustLine: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  trustLineMuted: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  messageCtaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  messageCtaRing: {
    padding: 2,
    borderRadius: radius.button,
  },
  messageCtaInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  messageCtaText: { fontSize: 16, fontWeight: '800', color: colors.primary, flexShrink: 1 },
  dualActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dualMessageOuter: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  dualMessageRing: {
    flex: 1,
    width: '100%',
    minHeight: 52,
    padding: 2,
    borderRadius: radius.button,
    justifyContent: 'center',
  },
  dualMessageInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dualMessageText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    flexShrink: 1,
  },
  dualViewOuter: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  dualViewGrad: {
    flex: 1,
    width: '100%',
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualViewText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
  },
  dualViewTextMuted: { color: 'rgba(255,255,255,0.72)' },
});
