/**
 * PL6a — Agreement & confirmation after offer accept (trust + structured summary + CTAs).
 */
import { CancellationSummaryCard, type CancellationBandSummary } from '@/components/plans/CancellationSummaryCard';
import { GroupHostCancellationModal } from '@/components/plans/GroupHostCancellationModal';
import { PlanAgreementCTAButton } from '@/components/plans/agreement/PlanAgreementCTAButton';
import { PlanAgreementStatusBadge } from '@/components/plans/agreement/PlanAgreementStatusBadge';
import { PlanAgreementUserHeader, type AgreementParty } from '@/components/plans/agreement/PlanAgreementUserHeader';
import { PreAgreementFullscreenModal } from '@/components/plans/agreement/PreAgreementFullscreenModal';
import { EscrowPolicySignOffModal } from '@/components/plans/EscrowPolicySignOffModal';
import { SafetyCaveatInterstitial } from '@/components/plans/SafetyCaveatInterstitial';
import { PlanConfirmationModal } from '@/components/plans/agreement/PlanConfirmationModal';
import { GroupSplitAgreementPanel } from '@/components/plans/agreement/GroupSplitAgreementPanel';
import { GroupEscrowStatusCard } from '@/components/plans/agreement/GroupEscrowStatusCard';
import { isGroupSplitPlan, formatGroupSplitCents, hostShareFromGuestCommitments, projectedHostShareCents } from '@/lib/plans/groupSplitDynamic';
import {
  deriveEscrowPhase,
  resolveEscrowScreenContent,
} from '@/lib/escrow/escrowScreenContent';
import { PlanEscrowPaymentCard } from '@/components/plans/agreement/PlanEscrowPaymentCard';
import { AgreementPaymentPreviewCard } from '@/components/plans/agreement/AgreementPaymentPreviewCard';
import { HighValueEscrowNoticeCard } from '@/components/plans/agreement/HighValueEscrowNoticeCard';
import { MeetupFundingReminderBanner } from '@/components/plans/agreement/MeetupFundingReminderBanner';
import { PlanSummaryCard } from '@/components/plans/agreement/PlanSummaryCard';
import { DiscoveryGradientBg } from '@/components/ui/DiscoveryGradientBg';
import { AgreementScreenSkeleton } from '@/components/plans/agreement/AgreementScreenSkeleton';
import { PlanAgreementEmptyState, resolveAgreementEmptyReason } from '@/components/plans/agreement/PlanAgreementEmptyState';
import { Screen } from '@/components/Screen';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { openPlanMeetupChat, PlanMeetupChatError } from '@/lib/messaging/openPlanMeetupChat';
import {
  formatEscrowMoney,
  getAgreementPaymentPreview,
  isMeetupWithinHours,
} from '@/lib/escrow/escrowPaymentPreview';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { isUserEscrowLegFunded, isSplitEscrowPattern } from '@/lib/escrow/splitEscrowFunding';
import { MAX_ESCROW_TIER1_CENTS, patternBLegGrossCents } from '@/lib/plans/planFinancialConfig';
import { confirmFreePlan, proceedToSecurePayment } from '@/lib/plans/planAgreementActions';
import { bothAgreementPartiesConfirmed } from '@/lib/plans/agreementConfirmations';
import { fetchPlanAgreementBundle } from '@/lib/plans/fetchPlanAgreementBundle';
import {
  hasEscrowPolicySignoff,
  needsSafetyCaveatGate,
} from '@/lib/plans/groupPlanAnnexure';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { goToDiscoveryFeed } from '@/lib/navigation/goToDiscoveryFeed';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';
import {
  goodwillCreditCents,
  goodwillCreditCentsForTier,
} from '@/lib/plans/cancellationPolicy';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer, SubscriptionTier } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

type CancellationOutcome = {
  goodwill_credit: number;
  guest_credit: number;
  host_credit: number;
  cancel_type: 'early' | 'late' | 'no_show';
  band: string | null;
};

function cancelBandFromOutcome(outcome: CancellationOutcome): CancellationBandSummary {
  if (outcome.cancel_type === 'no_show') return 'no_show';
  if (outcome.cancel_type === 'early') return 'early';
  return 'late';
}

function formatMyEscrowAmount(
  escrow: DbEscrowTransaction,
  userId: string,
  isHost: boolean,
  isGroupSplit: boolean
): string {
  if (isGroupSplit) {
    return formatGroupSplitCents(escrow.amount_cents, escrow.currency);
  }
  if (isSplitEscrowPattern(escrow.escrow_pattern)) {
    const leg = userId === escrow.host_id ? 'host' : 'guest';
    return formatEscrowMoney(
      patternBLegGrossCents(escrow, leg),
      escrow.currency
    );
  }
  return formatEscrowMoney(escrow.amount_cents, escrow.currency);
}

type FundedWaitingViewProps = {
  myEscrow: DbEscrowTransaction;
  isHost: boolean;
  isGroupSplit: boolean;
  plan: DbPlan;
  guestEscrowRows: DbEscrowTransaction[];
  currentUserId: string;
};

function FundedWaitingView({
  myEscrow,
  isHost,
  isGroupSplit,
  plan,
  guestEscrowRows,
  currentUserId,
}: FundedWaitingViewProps) {
  const amountLabel = formatMyEscrowAmount(myEscrow, currentUserId, isHost, isGroupSplit);

  if (!isHost) {
    return (
      <View style={styles.fundedContainer}>
        <View style={styles.fundedIconRow}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        </View>
        <Text style={styles.fundedTitle}>Your payment is secured</Text>
        <Text style={styles.fundedAmount}>{amountLabel}</Text>
        {isGroupSplit ? (
          <Text style={styles.fundedMessage}>
            Waiting for the host to close the group and complete their payment. You will be notified
            when the meetup is confirmed.
          </Text>
        ) : (
          <Text style={styles.fundedMessage}>
            Your escrow payment is held securely. The meetup will be confirmed once all payments are
            complete.
          </Text>
        )}
      </View>
    );
  }

  if (isHost && isGroupSplit) {
    const pendingGuests = guestEscrowRows.filter((e) => e.status !== 'funded');
    const fundedGuests = guestEscrowRows.filter((e) => e.status === 'funded');

    return (
      <View style={styles.fundedContainer}>
        <View style={styles.fundedIconRow}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        </View>
        <Text style={styles.fundedTitle}>Your payment is secured</Text>
        <Text style={styles.fundedAmount}>{amountLabel}</Text>
        <View style={styles.guestStatusSummary}>
          <Text style={styles.guestStatusLabel}>
            {`${fundedGuests.length} of ${guestEscrowRows.length} guests have paid`}
          </Text>
          {pendingGuests.length > 0 ? (
            <Text style={styles.pendingGuestsNote}>
              {`Waiting for ${pendingGuests.length} guest${pendingGuests.length === 1 ? '' : 's'} to fund their share. They have been notified.`}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fundedContainer}>
      <View style={styles.fundedIconRow}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
      </View>
      <Text style={styles.fundedTitle}>Your payment is secured</Text>
      <Text style={styles.fundedMessage}>
        Waiting for the guest to fund their share. They have been notified.
      </Text>
    </View>
  );
}

type PlanConfirmedViewProps = {
  onGoToChat: () => void;
};

function PlanConfirmedView({ onGoToChat }: PlanConfirmedViewProps) {
  return (
    <View style={styles.confirmedContainer}>
      <View style={styles.fundedIconRow}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
      </View>
      <Text style={styles.confirmedTitle}>Meetup confirmed!</Text>
      <Text style={styles.confirmedMessage}>
        All payments are secured. Your meetup is confirmed and ready to go.
      </Text>
      <Pressable
        onPress={onGoToChat}
        style={({ pressed }) => [styles.confirmedPrimaryOuter, pressed && { opacity: 0.94 }]}
        accessibilityRole="button"
        accessibilityLabel="Go to chat"
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.confirmedPrimaryGrad}
        >
          <Text style={styles.confirmedPrimaryLabel}>Go to chat</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function AgreementTopNav({ planId }: { planId?: string }) {
  const backFallback = planId ? (`/plan/${planId}` as Href) : undefined;

  return (
    <View style={styles.topNav}>
      <Pressable
        onPress={() => goBackOrFallback(backFallback)}
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
  const { id, offerId: offerIdParam } = useLocalSearchParams<{ id: string; offerId?: string }>();
  const { user, dbUser } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [offer, setOffer] = useState<DbPlanOffer | null>(null);
  const [hostParty, setHostParty] = useState<AgreementParty | null>(null);
  const [guestParty, setGuestParty] = useState<AgreementParty | null>(null);
  /** False until the current `load()` finishes — avoids flashing “no offer” while data is still fetching. */
  const [loadDone, setLoadDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelOptionsOpen, setCancelOptionsOpen] = useState(false);
  const [noShowConfirmOpen, setNoShowConfirmOpen] = useState(false);
  const [mutualCancelOpen, setMutualCancelOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [cancellationOutcome, setCancellationOutcome] = useState<CancellationOutcome | null>(null);
  const [hasVotedMutualCancel, setHasVotedMutualCancel] = useState(false);
  const [mutualVoteCount, setMutualVoteCount] = useState(0);
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [counterpartyKycTier, setCounterpartyKycTier] = useState<number | null>(null);
  const [existingEscrowId, setExistingEscrowId] = useState<string | null>(null);
  const [myEscrow, setMyEscrow] = useState<DbEscrowTransaction | null>(null);
  const [guestEscrowRows, setGuestEscrowRows] = useState<DbEscrowTransaction[]>([]);
  const [showTermsWarning, setShowTermsWarning] = useState(false);
  const [escrowPolicyOpen, setEscrowPolicyOpen] = useState(false);
  const [safetyGateOpen, setSafetyGateOpen] = useState(false);
  const [groupHostCancelOpen, setGroupHostCancelOpen] = useState(false);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

  const userConfirmed = useMemo(
    () => !!(user?.id && confirmationUserIds.includes(user.id)),
    [confirmationUserIds, user?.id]
  );
  const bothConfirmed = useMemo(
    () => (plan && offer ? bothAgreementPartiesConfirmed(confirmationUserIds, plan, offer) : false),
    [confirmationUserIds, plan, offer]
  );

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) {
      setLoadDone(true);
      return;
    }
    setLoadDone(false);
    setLoadError(null);
    try {
      const { data, error } = await fetchPlanAgreementBundle(supabase, id, {
        offerId: offerIdParam ?? null,
        userId: user?.id ?? null,
      });

      if (error || !data) {
        setLoadError(error ?? 'Agreement not available');
        setPlan(null);
        setOffer(null);
        setHostParty(null);
        setGuestParty(null);
        setConfirmationUserIds([]);
        setMutualVoteCount(0);
        setHasVotedMutualCancel(false);
        setCounterpartyKycTier(null);
        setExistingEscrowId(null);
        setMyEscrow(null);
        setGuestEscrowRows([]);
        return;
      }

      const voteIds = data.mutualVoteIds;
      setConfirmationUserIds(data.confirmationUserIds);
      setMutualVoteCount(voteIds.length);
      setHasVotedMutualCancel(!!(user?.id && voteIds.includes(user.id)));
      setPlan(data.plan);
      setOffer(data.offer);
      setHostParty(
        data.hostProfile
          ? {
              userId: data.hostProfile.user_id,
              name: data.hostProfile.display_name ?? 'Host',
              avatarUrl: data.hostProfile.avatar_url,
              verified: !!data.hostProfile.verified_badge,
            }
          : null
      );
      setGuestParty(
        data.guestProfile
          ? {
              userId: data.guestProfile.user_id,
              name: data.guestProfile.display_name ?? 'Guest',
              avatarUrl: data.guestProfile.avatar_url,
              verified: !!data.guestProfile.verified_badge,
            }
          : null
      );
      setCounterpartyKycTier(data.counterpartyKycTier);
      setExistingEscrowId(data.escrowId);
      setMyEscrow(data.myEscrow);
      setGuestEscrowRows(data.guestEscrowRows);
    } finally {
      setLoadDone(true);
    }
  }, [id, offerIdParam, user?.id]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!id || !isSupabaseConfigured || !hasVotedMutualCancel) return;
    const channel = supabase.channel(
      `plan-mutual-${id}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
    );
    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as { status?: string };
          if (next.status === 'cancelled') {
            showFeedback('success', 'Mutual cancellation', 'Plan mutually cancelled. Refund processed.');
            goToDiscoveryFeed();
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, hasVotedMutualCancel]);

  function onHighValueAction() {
    if (dbUser?.subscription_tier !== 'PLATINUM') {
      setUpgradeOpen(true);
      return;
    }
    router.push('/kyc' as Href);
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    const channel = supabase.channel(
      `plan-agreement-${id}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
    );
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agreement_confirmations', filter: `plan_id=eq.${id}` },
        () => {
          void loadRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${id}` },
        () => {
          void loadRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'escrow_transactions', filter: `plan_id=eq.${id}` },
        () => {
          void loadRef.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  if (!user || !loadDone) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          {user ? <AgreementTopNav planId={id} /> : null}
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <AgreementScreenSkeleton />
          </ScrollView>
        </View>
      </Screen>
    );
  }

  if (loadError || !plan || !offer) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <AgreementTopNav planId={id} />
          <PlanAgreementEmptyState
            planId={id ?? ''}
            reason={resolveAgreementEmptyReason(loadError, !!plan, !!offer)}
            planTitle={plan?.title}
          />
        </View>
      </Screen>
    );
  }

  if (plan.status === 'cancelled') {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <AgreementTopNav planId={id} />
          <PlanAgreementEmptyState planId={id ?? ''} reason="cancelled" planTitle={plan.title} />
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
          <AgreementTopNav planId={id} />
          <PlanAgreementEmptyState planId={id ?? ''} reason="no_access" planTitle={plan.title} />
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

  const slotAccepted = offerRow.status === 'accepted';
  const awaitingPay =
    planRow.status === 'awaiting_payment' ||
    (planRow.is_group_plan && slotAccepted && paymentRequired);
  const needsConfirm =
    planRow.status === 'agreed' ||
    (planRow.is_group_plan && slotAccepted && !paymentRequired && planRow.status === 'negotiating');

  const escrowCents =
    paymentRequired && myEscrow?.amount_cents ? myEscrow.amount_cents : null;
  const paymentPreview =
    paymentRequired &&
    user?.id &&
    (planRow.agreed_price_cents ?? offerRow.amount_cents ?? planRow.starting_price_cents ?? 0) > 0
      ? getAgreementPaymentPreview(
          planRow,
          offerRow.bidder_id,
          planRow.agreed_price_cents ?? offerRow.amount_cents ?? planRow.starting_price_cents ?? 0,
          user.id
        )
      : null;
  const userIsPayer = paymentPreview?.userIsPayer ?? false;
  const isHighValue = escrowCents != null && escrowCents > MAX_ESCROW_TIER1_CENTS;
  const highValuePlatinum = dbUser?.subscription_tier === 'PLATINUM';
  const highValueTier3 = (dbUser?.kyc_tier ?? 1) >= 3;
  const highValueCounterpartyOk =
    planRow.escrow_pattern !== 'C' || (counterpartyKycTier ?? 1) >= 3;
  const highValueReady = !isHighValue || (highValuePlatinum && highValueTier3 && highValueCounterpartyOk);
  const payerBlockedByHighValue = isHighValue && userIsPayer && !highValueReady;

  const isGroupSplit = isGroupSplitPlan(planRow);
  const isPlanActive = planRow.status === 'active';
  const userLegFunded = !!(myEscrow && user?.id && isUserEscrowLegFunded(myEscrow, user.id));
  const agreementPhase = deriveEscrowPhase({
    isGroupSplit,
    isHost,
    hostEscrowId: planRow.host_escrow_id ?? null,
    myEscrowStatus: myEscrow?.status ?? null,
    planStatus: planRow.status ?? null,
    planTier: paymentRequired ? 'paid' : 'free',
    userLegFunded,
  });
  const splitRatioLabel =
    planRow.host_contribution_bps != null
      ? `${Math.round(planRow.host_contribution_bps / 100)}% host / ${100 - Math.round(planRow.host_contribution_bps / 100)}% guest`
      : null;
  const agreementContent = resolveEscrowScreenContent({
    screen: 'agreement',
    planTier: paymentRequired ? 'paid' : 'free',
    planKind: planRow.is_group_plan ? 'group' : planRow.is_mood_plan ? 'mood' : 'standard',
    pattern: (planRow.escrow_pattern as 'A' | 'B' | 'C') ?? null,
    role: isHost ? 'host' : 'guest',
    phase: agreementPhase,
    isGroupSplit,
    splitRatioLabel,
    counterpartyName: isHost ? guestParty?.name ?? null : hostParty?.name ?? null,
    userLegFunded,
  });
  const showPaymentFlow = paymentRequired && (needsConfirm || awaitingPay);
  const isFunded = userLegFunded;
  const isPendingPayment =
    !!myEscrow &&
    !userLegFunded &&
    (myEscrow.status === 'pending_funding' ||
      (!!user?.id && getEscrowFundingUiState(myEscrow, user.id).canFund));

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
      if (res.error === 'high_value_requires_platinum') {
        setUpgradeOpen(true);
        return;
      }
      if (res.error === 'high_value_requires_kyc_tier3') {
        showFeedback(
          'error',
          'Identity Tier 3 required',
          'Escrow above ₦5,000,000 requires advanced identity verification (Tier 3). This is available to Platinum members.'
        );
        return;
      }
      if (res.error === 'high_value_counterparty_requires_kyc_tier3') {
        showFeedback(
          'error',
          'Counterparty verification required',
          'Your counterparty also needs Tier 3 verification for this amount.'
        );
        return;
      }
      console.error('Payment setup failed — full error:', res.error);
      showFeedback('error', 'Payment setup failed', res.error);
      return;
    }
    if (res.escrowId) router.replace(`/escrow/${res.escrowId}` as Href);
  }

  async function proceedToLegalGate(action: 'free' | 'pay' | 'ack') {
    if (!user?.id) return;
    const hasEscrow = await hasEscrowPolicySignoff(planRow.id, user.id);
    if (!hasEscrow) {
      setPendingLegal(action);
      setEscrowPolicyOpen(true);
      return;
    }
    const counterpartyId = isHost ? offerRow.bidder_id : planRow.creator_id;
    if (action === 'pay') {
      const needsSafety = await needsSafetyCaveatGate(planRow.id, user.id, counterpartyId);
      if (needsSafety) {
        setPendingLegal(action);
        setSafetyGateOpen(true);
        return;
      }
    }
    setPendingLegal(action);
    setLegalGateOpen(true);
  }

  function openLegalGate(action: 'free' | 'pay' | 'ack') {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    void proceedToLegalGate(action);
  }

  async function onLegalGateConfirm() {
    if (!user) return;
    setLegalBusy(true);
    const { error } = await supabase.rpc('record_agreement_confirmation', {
      p_plan_id: planRow.id,
      ...(planRow.is_group_plan && offerRow.id ? { p_offer_id: offerRow.id } : {}),
    });
    if (error) {
      setLegalBusy(false);
      showFeedback('error', 'Could not record confirmation', error.message);
      return;
    }
    const { data: refreshed } = await supabase.from('agreement_confirmations').select('user_id').eq('plan_id', planRow.id);
    const ids = (refreshed ?? []).map((r) => r.user_id as string);
    setConfirmationUserIds(ids);
    const complete = bothAgreementPartiesConfirmed(ids, planRow, offerRow);
    setLegalGateOpen(false);
    setLegalBusy(false);
    setPendingLegal(null);
    if (complete) {
      if (!paymentRequired) {
        await runConfirmFree();
      } else {
        const preview = getAgreementPaymentPreview(
          planRow,
          offerRow.bidder_id,
          planRow.agreed_price_cents ?? offerRow.amount_cents ?? planRow.starting_price_cents ?? 0,
          user.id
        );
        if (preview.userIsPayer) {
          await runProceedPayment();
        } else {
          await load();
        }
      }
    } else {
      await load();
    }
  }

  async function handleCancel({ noShow }: { noShow: boolean }) {
    setCancelOpen(false);
    setCancelOptionsOpen(false);
    setNoShowConfirmOpen(false);
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
      const { data, error: rpcErr } = await supabase.rpc('submit_plan_cancellation', {
        p_plan_id: planRow.id,
        p_no_show: noShow,
      });
      if (rpcErr) {
        showFeedback('error', 'Could not cancel', rpcErr.message);
        return;
      }
      setCancellationOutcome(data as CancellationOutcome);
      setOutcomeOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function onCancelConfirmed() {
    await handleCancel({ noShow: false });
  }

  function onCancelSecondaryPress() {
    if (isHost && planRow.is_group_plan) {
      setGroupHostCancelOpen(true);
      return;
    }
    if (isBidder) setCancelOptionsOpen(true);
    else setCancelOpen(true);
  }

  async function handleVoteMutualCancel() {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('vote_mutual_plan_cancel', { p_plan_id: planRow.id });
    setBusy(false);
    if (error) {
      showFeedback('error', 'Could not vote', error.message);
      return;
    }
    const result = data as { status?: string };
    if (result.status === 'completed') {
      setMutualCancelOpen(false);
      showFeedback('success', 'Mutual cancellation', 'Plan mutually cancelled. Refund processed.');
      goToDiscoveryFeed();
      return;
    }
    setHasVotedMutualCancel(true);
    setMutualVoteCount((c) => Math.max(c, 1));
  }

  function dismissOutcome() {
    setOutcomeOpen(false);
    goToDiscoveryFeed();
  }

  async function onMessageCounterpart() {
    if (!user) return;
    try {
      let offersForChat: DbPlanOffer[] = [offerRow];
      if (planRow.is_group_plan) {
        const { data, error } = await supabase
          .from('plan_offers')
          .select('*')
          .eq('plan_id', planRow.id);
        if (error) {
          showFeedback('error', 'Chat', error.message);
          return;
        }
        offersForChat = (data ?? []) as DbPlanOffer[];
      }
      await openPlanMeetupChat({
        plan: planRow,
        userId: user.id,
        isCreator: isHost,
        offers: offersForChat,
      });
    } catch (e) {
      const message =
        e instanceof PlanMeetupChatError || e instanceof Error
          ? e.message
          : 'Could not open chat';
      showFeedback(
        'warning',
        'Chat',
        message
      );
    }
  }

  const showMessageCta =
    planRow.status === 'agreed' ||
    planRow.status === 'awaiting_payment' ||
    planRow.status === 'active';

  async function goToEscrowPayment() {
    if (busy) return;
    if (isGroupSplit && isHost && !planRow.host_escrow_id) {
      router.push(`/plan/${planRow.id}/offers` as Href);
      return;
    }
    if (!userConfirmed) {
      setShowTermsWarning(true);
      return;
    }
    if (payerBlockedByHighValue) {
      onHighValueAction();
      return;
    }
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (existingEscrowId) {
      router.replace(`/escrow/${existingEscrowId}` as Href);
      return;
    }
    if (offerRow.bidder_id) {
      const { data: escrowRow } = await supabase
        .from('escrow_transactions')
        .select('id')
        .eq('plan_id', planRow.id)
        .eq('guest_id', offerRow.bidder_id)
        .maybeSingle();
      if (escrowRow?.id) {
        setExistingEscrowId(escrowRow.id as string);
        router.replace(`/escrow/${escrowRow.id}` as Href);
        return;
      }
    }
    if (!bothConfirmed) {
      showFeedback(
        'warning',
        'Waiting for confirmation',
        'Both parties must review and confirm the agreement before secure payment.'
      );
      return;
    }
    await runProceedPayment();
  }

  const counterpartyPayerName = isHost ? guestParty?.name ?? 'Guest' : hostParty?.name ?? 'Host';

  let primaryLabel = 'View plan';
  let onPrimary = () => router.replace(`/plan/${planRow.id}` as Href);
  let primaryDisabled = false;

  if (planRow.status === 'active') {
    primaryLabel = 'View plan';
    onPrimary = () => router.replace(`/plan/${planRow.id}` as Href);
    primaryDisabled = false;
  } else if (awaitingPay) {
    const otherName = isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host';
    if (isFunded) {
      primaryLabel = 'View plan';
      onPrimary = () => router.replace(`/plan/${planRow.id}` as Href);
      primaryDisabled = false;
    } else if (userIsPayer) {
      if (!agreementContent.showPaymentButton) {
        primaryLabel = agreementContent.waitingTitle ?? `Waiting for ${otherName}`;
        onPrimary = () => {};
        primaryDisabled = true;
      } else if (!bothConfirmed) {
        if (!userConfirmed) {
          primaryLabel = 'Review terms & pay';
          onPrimary = () => openLegalGate('pay');
          primaryDisabled = busy || legalBusy;
        } else {
          primaryLabel = `Waiting for ${otherName}`;
          onPrimary = () => {};
          primaryDisabled = true;
        }
      } else if (payerBlockedByHighValue) {
        primaryLabel = 'Complete high-value requirements';
        onPrimary = () => void goToEscrowPayment();
        primaryDisabled = false;
      } else if (existingEscrowId) {
        primaryLabel = 'Complete secure payment';
        onPrimary = () => void goToEscrowPayment();
        primaryDisabled = busy;
      } else {
        primaryLabel = 'Continue to secure payment';
        onPrimary = () => void goToEscrowPayment();
        primaryDisabled = busy;
      }
    } else if (existingEscrowId) {
      primaryLabel = 'View payment status';
      onPrimary = () => router.push(`/escrow/${existingEscrowId}` as Href);
      primaryDisabled = false;
    } else {
      primaryLabel = `Waiting for ${counterpartyPayerName}`;
      onPrimary = () => {};
      primaryDisabled = true;
    }
  } else if (needsConfirm) {
    const otherName = isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host';
    if (!userConfirmed) {
      if (!paymentRequired) {
        primaryLabel = 'Review & confirm plan';
        onPrimary = () => openLegalGate('free');
      } else if (userIsPayer) {
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
    } else if (userIsPayer) {
      if (!agreementContent.showPaymentButton) {
        primaryLabel = agreementContent.waitingTitle ?? `Waiting for ${counterpartyPayerName}`;
        onPrimary = () => {};
        primaryDisabled = true;
      } else {
        primaryLabel = payerBlockedByHighValue ? 'Complete high-value requirements' : 'Proceed to secure payment';
        onPrimary = () => void goToEscrowPayment();
        primaryDisabled = busy && !payerBlockedByHighValue;
      }
    } else if (existingEscrowId) {
      primaryLabel = 'View payment status';
      onPrimary = () => router.push(`/escrow/${existingEscrowId}` as Href);
      primaryDisabled = false;
    } else {
      primaryLabel = `Waiting for ${counterpartyPayerName}`;
      onPrimary = () => {};
      primaryDisabled = true;
    }
  }

  const showCancelPlan = needsConfirm || awaitingPay;
  const counterpartDisplay = isHost ? guestParty?.name ?? 'Guest' : hostParty?.name ?? 'Host';
  const counterpartMessageName =
    counterpartDisplay.trim().split(/\s+/)[0] || counterpartDisplay;
  const inlineMessageAndView = showMessageCta && primaryLabel === 'View plan';

  const meetupIso =
    planRow.agreed_scheduled_at ?? planRow.scheduled_at ?? offerRow.proposed_scheduled_at ?? null;
  const meetupSoon =
    paymentRequired && (needsConfirm || awaitingPay) && isMeetupWithinHours(meetupIso, 48);

  let paymentPreviewVariant: 'you_pay_next' | 'counterparty_pays' | 'split_you_pay' | 'split_waiting' | null =
    null;
  if (paymentPreview) {
    if (paymentPreview.pattern === 'B' && paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'split_you_pay';
    } else if (paymentPreview.pattern === 'B' && !paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'split_waiting';
    } else if (paymentPreview.userIsPayer) {
      paymentPreviewVariant = 'you_pay_next';
    } else {
      paymentPreviewVariant = 'counterparty_pays';
    }
  }

  const userPaymentGrossCents = myEscrow?.amount_cents ?? null;
  let paymentCardGrossCents: number | null = null;
  if (paymentPreviewVariant === 'counterparty_pays' || paymentPreviewVariant === 'split_waiting') {
    const guestEsc =
      guestEscrowRows.find((e) => e.guest_id === offerRow.bidder_id) ?? guestEscrowRows[0];
    paymentCardGrossCents = guestEsc?.amount_cents ?? null;
  } else if (paymentPreviewVariant) {
    paymentCardGrossCents = userPaymentGrossCents;
  }

  const gateTitle = 'Verification required to continue';
  const gateMessage =
    'Confirming plans and sending secure payments requires a verified identity on LinkUp.';

  const leadSub =
    agreementContent.headerSubtitle ??
    (paymentRequired
      ? 'Review the summary below. Secure payment happens on the next screen, not while you negotiate.'
      : 'Review the meetup summary and confirm when you are ready.');

  const guestTier = (dbUser?.subscription_tier ?? 'FREE') as SubscriptionTier;
  const noShowGoodwillPreview = isBidder
    ? goodwillCreditCentsForTier(goodwillCreditCents(escrowCents ?? 0), guestTier)
    : 0;

  const outcomeCardProps = cancellationOutcome
    ? {
        band: cancelBandFromOutcome(cancellationOutcome),
        refundCents: cancellationOutcome.guest_credit,
        feeCents: cancellationOutcome.host_credit,
        goodwillCents: cancellationOutcome.goodwill_credit,
        roleLabel: (isBidder ? 'Guest' : 'Host') as 'Guest' | 'Host',
      }
    : null;

  const cancellationPlanType = planRow.is_group_plan
    ? 'group'
    : planRow.is_mood_plan
      ? 'mood'
      : 'standard';

  const agreementScreen = (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <DiscoveryGradientBg />
        <UpgradePrompt
          visible={upgradeOpen}
          feature="escrow.high_value"
          requiredTier="PLATINUM"
          icon="diamond-outline"
          title="High-value escrow"
          message="Commitments above ₦5,000,000 require Platinum membership and Tier 3 identity verification before secure payment."
          onUpgrade={() => {
            setUpgradeOpen(false);
            router.push('/subscription' as Href);
          }}
          onDismiss={() => setUpgradeOpen(false)}
        />
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
        <Modal visible={cancelOptionsOpen} animationType="slide" transparent onRequestClose={() => setCancelOptionsOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setCancelOptionsOpen(false)}>
            <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Why are you cancelling?</Text>
              <Pressable
                style={styles.cancelOption}
                onPress={() => void handleCancel({ noShow: false })}
                disabled={busy}
              >
                <Text style={styles.cancelOptionTitle}>I want to cancel</Text>
                <Text style={styles.cancelOptionDesc}>
                  Standard cancellation. See refund policy below
                </Text>
              </Pressable>
              <Pressable
                style={[styles.cancelOption, styles.cancelOptionWarning]}
                onPress={() => {
                  setCancelOptionsOpen(false);
                  setNoShowConfirmOpen(true);
                }}
                disabled={busy}
              >
                <Text style={styles.cancelOptionTitleWarning}>The host didn&apos;t show up</Text>
                <Text style={styles.cancelOptionDesc}>
                  Report a no-show. Full refund
                  {noShowGoodwillPreview > 0
                    ? ` and up to ₦${(noShowGoodwillPreview / 100).toLocaleString()} goodwill credit`
                    : ''}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
        <PlanConfirmationModal
          visible={noShowConfirmOpen}
          title="Report host no-show?"
          message="This will be recorded. False reports may affect your account standing. Continue only if the host genuinely did not show up."
          confirmLabel="Report no-show"
          cancelLabel="Go back"
          onCancel={() => setNoShowConfirmOpen(false)}
          onConfirm={() => void handleCancel({ noShow: true })}
        />
        <Modal visible={mutualCancelOpen} animationType="slide" transparent onRequestClose={() => setMutualCancelOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setMutualCancelOpen(false)}>
            <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Mutual cancellation</Text>
              <Text style={styles.mutualCancelDesc}>
                Both parties agree to cancel with a full refund to whoever funded escrow. No cancellation fees or
                strikes apply. The other person must also confirm.
              </Text>
              <Pressable
                style={styles.mutualCancelConfirm}
                onPress={() => void handleVoteMutualCancel()}
                disabled={busy || hasVotedMutualCancel}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.mutualCancelConfirmLabel}>
                  {hasVotedMutualCancel ? 'Waiting for the other person…' : 'I agree to mutual cancellation'}
                </Text>
              </Pressable>
              {hasVotedMutualCancel && mutualVoteCount < 2 ? (
                <Text style={styles.mutualCancelWaiting}>
                  Waiting for the other person to agree…
                </Text>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
        <Modal visible={outcomeOpen} animationType="slide" transparent onRequestClose={dismissOutcome}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.outcomeModalCard}>
              <CancellationSummaryCard
                outcome={outcomeCardProps}
                planType={cancellationPlanType}
                escrowPattern={planRow.escrow_pattern}
              />
              <Pressable style={styles.outcomeDoneBtn} onPress={dismissOutcome}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.outcomeDoneLabel}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <PreAgreementFullscreenModal
          visible={legalGateOpen}
          planTitle={planRow.title}
          whenLabel={whenLabel}
          locationLabel={locationLabel ?? null}
          priceLabel={priceLabel}
          escrowAmountCents={
            userPaymentGrossCents != null && userPaymentGrossCents > 0 ? userPaymentGrossCents : null
          }
          currencyLabel={planRow.currency ?? 'NGN'}
          busy={legalBusy}
          onConfirm={() => void onLegalGateConfirm()}
          onTermsRequired={() => setShowTermsWarning(true)}
          planType={cancellationPlanType}
          escrowPattern={planRow.escrow_pattern}
        />
        <GroupHostCancellationModal
          planId={planRow.id}
          visible={groupHostCancelOpen}
          onCancelled={() => {
            setGroupHostCancelOpen(false);
            goToDiscoveryFeed();
          }}
          onDismiss={() => setGroupHostCancelOpen(false)}
        />
        {user?.id ? (
          <EscrowPolicySignOffModal
            visible={escrowPolicyOpen}
            planId={planRow.id}
            userId={user.id}
            escrowPattern={planRow.escrow_pattern ?? undefined}
            onSigned={() => {
              setEscrowPolicyOpen(false);
              if (pendingLegal) void proceedToLegalGate(pendingLegal);
            }}
          />
        ) : null}
        {user?.id && safetyGateOpen ? (
          <SafetyCaveatInterstitial
            planId={planRow.id}
            userId={user.id}
            onAcknowledged={() => {
              setSafetyGateOpen(false);
              if (pendingLegal) setLegalGateOpen(true);
            }}
          />
        ) : null}
        <Modal
          visible={showTermsWarning}
          animationType="fade"
          transparent
          statusBarTranslucent
          onRequestClose={() => setShowTermsWarning(false)}
        >
          <View style={styles.termsWarningOverlay}>
            <View style={styles.termsWarningCard}>
              <View style={styles.termsWarningIconWrap}>
                <Ionicons name="alert-circle-outline" size={32} color={colors.warning} />
              </View>
              <Text style={styles.termsWarningTitle}>Please review the terms</Text>
              <Text style={styles.termsWarningBody}>
                You need to read and agree to the plan terms and policy before proceeding to payment.
                Please check the box below to confirm.
              </Text>
              <Pressable
                onPress={() => setShowTermsWarning(false)}
                style={styles.termsWarningBtn}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.termsWarningBtnGrad}
                >
                  <Text style={styles.termsWarningBtnTxt}>Got it</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Modal>

        <AgreementTopNav planId={id} />

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
                  ? 'Both confirmed. Finalize in one step'
                  : userConfirmed
                    ? `Waiting for ${isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host'} to confirm`
                    : 'Review details. Both people must confirm the summary'
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

          {isHighValue && paymentRequired && (needsConfirm || awaitingPay) && escrowCents != null ? (
            <HighValueEscrowNoticeCard
              amountCents={escrowCents}
              currency={planRow.currency ?? 'NGN'}
              escrowPattern={planRow.escrow_pattern}
              userTier={dbUser?.subscription_tier}
              userKycTier={dbUser?.kyc_tier}
              counterpartyKycTier={counterpartyKycTier}
              onUpgrade={onHighValueAction}
            />
          ) : null}

          {agreementContent.showGroupHostCloseGuard ? (
            <View style={styles.trustCard}>
              <View style={styles.trustSectionRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.trustSectionLabel}>Host action needed</Text>
              </View>
              <Text style={styles.trustTitle}>Close the group first</Text>
              <Text style={styles.trustLineMuted}>
                Your share is calculated once you close the group. Go to Manage Offers to review your
                projected share and close the group.
              </Text>
              <Pressable
                onPress={() => router.push(`/plan/${planRow.id}/offers` as Href)}
                style={({ pressed }) => [styles.termsWarningBtn, pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.termsWarningBtnGrad}
                >
                  <Text style={styles.termsWarningBtnTxt}>Go to Manage Offers</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}

          {agreementContent.showProjectedHostShare ? (
            <View style={styles.trustCard}>
              <Text style={styles.trustTitle}>Your projected host share</Text>
              <Text style={styles.trustLineMuted}>{agreementContent.projectedShareNote}</Text>
              <Text style={[styles.trustTitle, { marginTop: spacing.sm }]}>
                {formatGroupSplitCents(
                  guestEscrowRows.length > 0
                    ? hostShareFromGuestCommitments(planRow, guestEscrowRows)
                    : projectedHostShareCents(planRow),
                  planRow.currency
                )}
              </Text>
            </View>
          ) : null}

          {isGroupSplitPlan(plan) && user?.id ? (
            <GroupSplitAgreementPanel
              plan={plan}
              offer={offerRow}
              isHost={isHost}
              currentUserId={user.id}
              onRefresh={() => void loadRef.current()}
              showPaymentCta={agreementContent.showPaymentButton}
            />
          ) : plan.is_group_plan && plan.is_paid ? (
            <GroupEscrowStatusCard plan={plan} />
          ) : null}

          {showPaymentFlow &&
          agreementContent.showPaymentButton &&
          !plan.is_group_plan &&
          plan.is_paid &&
          user?.id &&
          !isFunded ? (
            <PlanEscrowPaymentCard
              plan={plan}
              offer={offerRow}
              currentUserId={user.id}
              userIsPayer={userIsPayer}
            />
          ) : null}

          {showPaymentFlow &&
          agreementContent.showPaymentButton &&
          paymentPreview &&
          paymentPreviewVariant &&
          paymentCardGrossCents != null &&
          paymentCardGrossCents > 0 &&
          !isFunded ? (
            <AgreementPaymentPreviewCard
              grossCents={paymentCardGrossCents}
              currency={planRow.currency ?? 'NGN'}
              pattern={paymentPreview.pattern}
              plan={planRow}
              variant={paymentPreviewVariant}
            />
          ) : null}

          <CancellationSummaryCard
            planType={cancellationPlanType}
            escrowPattern={planRow.escrow_pattern}
          />

          <View style={styles.trustCard}>
            <View style={styles.trustSectionRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.trustSectionLabel}>Accepted terms</Text>
            </View>
            <LinearGradient
              colors={['rgba(94, 82, 255,0.35)', 'rgba(255, 74, 114,0.2)', 'transparent']}
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

          {isFunded && isPlanActive ? (
            <PlanConfirmedView onGoToChat={() => void onMessageCounterpart()} />
          ) : null}

          {isFunded && !isPlanActive && myEscrow && user?.id && (!isGroupSplit || isHost) ? (
            <FundedWaitingView
              myEscrow={myEscrow}
              isHost={isHost}
              isGroupSplit={isGroupSplit}
              plan={planRow}
              guestEscrowRows={guestEscrowRows}
              currentUserId={user.id}
            />
          ) : null}

          {inlineMessageAndView ? (
            <View style={styles.dualActionRow}>
              <Pressable
                onPress={() => void onMessageCounterpart()}
                style={({ pressed }) => [styles.dualMessageOuter, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`Message ${counterpartMessageName}`}
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
                      Message {counterpartMessageName}
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
                    Message {counterpartMessageName}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          ) : null}

          {showCancelPlan ? (
            <Pressable
              onPress={() => setMutualCancelOpen(true)}
              style={({ pressed }) => [styles.mutualCancelLink, pressed && { opacity: 0.9 }]}
              disabled={busy}
            >
              <Text style={styles.mutualCancelLinkText}>Suggest mutual cancellation</Text>
            </Pressable>
          ) : null}

          {showCancelPlan || !inlineMessageAndView ? (
            <PlanAgreementCTAButton
              omitPrimary={inlineMessageAndView || (isFunded && isPlanActive)}
              primaryLabel={primaryLabel}
              onPrimary={onPrimary}
              primaryDisabled={primaryDisabled}
              primaryLoading={busy}
              secondaryLabel={showCancelPlan ? 'Cancel plan' : undefined}
              onSecondary={showCancelPlan ? onCancelSecondaryPress : undefined}
              secondaryDisabled={busy}
            />
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );

  return agreementScreen;
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
  feedTopBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  userHeaderCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
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
  title: { fontSize: 22, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.sm },
  muted: {
    fontSize: 15,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    lineHeight: 22,
    fontWeight: '600',
  },
  linkBtn: { paddingVertical: spacing.md },
  linkTxt: { color: colors.primary, fontWeight: '800',
    fontFamily: fonts.bold, fontSize: 16 },
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
    fontFamily: fonts.bold,
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
    borderColor: 'rgba(94, 82, 255, 0.12)',
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
  trustTitle: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.sm },
  trustLine: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, fontFamily: fonts.medium, },
  trustLineMuted: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4, fontFamily: fonts.medium, },
  messageCtaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
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
  messageCtaText: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary, flexShrink: 1 },
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
        shadowColor: '#5E52FF',
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
    fontFamily: fonts.bold,
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
        shadowColor: '#5E52FF',
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
    fontFamily: fonts.bold,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
  },
  dualViewTextMuted: { color: 'rgba(255,255,255,0.72)' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  sheetTitle: { fontSize: 20, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.md },
  cancelOption: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  cancelOptionWarning: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  cancelOptionTitle: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  cancelOptionTitleWarning: { fontSize: 16, fontWeight: '800', color: colors.danger, marginBottom: 4, fontFamily: fonts.bold, },
  cancelOptionDesc: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19, fontFamily: fonts.medium, },
  mutualCancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  mutualCancelLinkText: { fontSize: 14, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
  mutualCancelDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  mutualCancelConfirm: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutualCancelConfirmLabel: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: '#fff' },
  mutualCancelWaiting: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  outcomeModalCard: {
    margin: spacing.md,
    marginTop: 'auto',
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  outcomeDoneBtn: {
    marginTop: spacing.sm,
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeDoneLabel: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: '#fff' },
  fundedContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    marginBottom: spacing.md,
    alignItems: 'center',
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
  fundedIconRow: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fundedTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  fundedAmount: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  fundedMessage: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  guestStatusSummary: {
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  guestStatusLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  pendingGuestsNote: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  confirmedContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    marginBottom: spacing.md,
    alignItems: 'center',
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
  confirmedTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  confirmedMessage: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  confirmedPrimaryOuter: {
    width: '100%',
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  confirmedPrimaryGrad: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedPrimaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  termsWarningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  termsWarningCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  termsWarningIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: 'rgba(232, 144, 8, 0.12)',
  },
  termsWarningTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  termsWarningBody: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  termsWarningBtn: { alignSelf: 'stretch', borderRadius: radius.button, overflow: 'hidden' },
  termsWarningBtnGrad: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  termsWarningBtnTxt: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
