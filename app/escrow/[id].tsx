/**
 * E1 — Escrow detail: Flutterwave funding, trust copy, timeline, release & disputes.
 */
import { EscrowConfirmModal } from '@/components/escrow/EscrowConfirmModal';
import { EscrowCounterpartyHeader, type EscrowParty } from '@/components/escrow/EscrowCounterpartyHeader';
import { EscrowFundCTA } from '@/components/escrow/EscrowFundCTA';
import { EscrowGroupHostShareBreakdownCard } from '@/components/escrow/EscrowGroupHostShareBreakdownCard';
import { EscrowScreenHeader } from '@/components/escrow/EscrowScreenHeader';
import { EscrowSinglePayerFundingCard } from '@/components/escrow/EscrowSinglePayerFundingCard';
import { EscrowSplitFundingCard } from '@/components/escrow/EscrowSplitFundingCard';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { EscrowStepIndicator } from '@/components/escrow/EscrowStepIndicator';
import { EscrowSummaryCard } from '@/components/escrow/EscrowSummaryCard';
import { EscrowTimeline } from '@/components/escrow/EscrowTimeline';
import { FundingDeadlineUrgencyBanner } from '@/components/escrow/FundingDeadlineUrgencyBanner';
import { OpenDisputeModal } from '@/components/escrow/OpenDisputeModal';
import { PaymentMethodSelector } from '@/components/escrow/PaymentMethodSelector';
import { EscrowPolicySignOffModal } from '@/components/plans/EscrowPolicySignOffModal';
import { SafetyCaveatInterstitial } from '@/components/plans/SafetyCaveatInterstitial';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { PlanFlowScreenSkeleton } from '@/components/ui/PlanFlowScreenSkeleton';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { Screen } from '@/components/Screen';
import { DiscoveryGradientBg } from '@/components/ui/DiscoveryGradientBg';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { buildEscrowTimeline } from '@/lib/escrow/buildEscrowTimeline';
import { formatEscrowMoney, isMeetupWithinHours, meetupHoursUntilLabel } from '@/lib/escrow/escrowPaymentPreview';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import {
  budgetFromGrossAmountCents,
  feeFromGrossAmountCents,
  patternBLegGrossCents,
} from '@/lib/plans/planFinancialConfig';
import { getReleaseRecipientLabel } from '@/lib/escrow/releaseCopy';
import {
  getUserEscrowBadgeDisplay,
  getUserPaymentStatusLabel,
  resolveCurrentUserPayCents,
  resolveEscrowRowLegAmountCents,
} from '@/lib/escrow/userEscrowPaymentDisplay';
import {
  confirmMeetupComplete,
  clearEscrowCheckoutPending,
  markEscrowFunded,
  openEscrowDisputeWithTicket,
  recordEscrowPaymentInitiated,
  releaseEscrowFunds,
} from '@/lib/escrow/escrowActions';
import { openEscrowCheckout } from '@/lib/escrow/openEscrowCheckout';
import { settleEscrowCheckout } from '@/lib/escrow/confirmEscrowPaymentAfterCheckout';
import { useEscrowConfirmation } from '@/lib/escrow/useEscrowConfirmation';
import { invokeVerifyEscrowPayment } from '@/lib/escrow/verifyEscrowPayment';
import { resumeEscrowSettlementIfNeeded } from '@/lib/escrow/resumeEscrowSettlement';
import {
  escrowPaymentConfirmedMessage,
  isEscrowFullyFundedForMeet,
  isUserEscrowLegFunded,
} from '@/lib/escrow/splitEscrowFunding';
import {
  escrowCheckoutInitiator,
  escrowCheckoutReference,
  escrowAwaitingFulfillment,
  escrowCheckoutReturned,
  escrowPaymentInitiated,
} from '@/lib/escrow/escrowCheckoutMetadata';
import { openFlutterwaveCheckoutInBrowser } from '@/lib/flutterwave/openFlutterwaveBrowser';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import { isGroupSplitPlan, isGroupHostCloseEscrowRow, resolveGroupHostShareCents, resolveGroupPlanTotalCents, resolveAcceptedGuestCommitmentCents } from '@/lib/plans/groupSplitDynamic';
import {
  hasEscrowPolicySignoff,
  needsSafetyCaveatGate,
} from '@/lib/plans/groupPlanAnnexure';
import {
  deriveEscrowPhase,
  resolveEscrowScreenContent,
} from '@/lib/escrow/escrowScreenContent';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbEscrowDispute, DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function stepActiveIndex(escrow: DbEscrowTransaction, plan: DbPlan | null): number {
  if (escrow.status === 'released') return 3;
  if (plan?.status === 'completed' && escrow.status === 'funded') return 2;
  if (escrow.status !== 'pending_funding') return 1;
  return 0;
}

export default function EscrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, dbUser } = useAuth();
  const [escrow, setEscrow] = useState<DbEscrowTransaction | null>(null);
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [guestEscrowRows, setGuestEscrowRows] = useState<DbEscrowTransaction[]>([]);
  const [acceptedGuestOffers, setAcceptedGuestOffers] = useState<
    Pick<DbPlanOffer, 'current_amount_cents' | 'amount_cents'>[]
  >([]);
  const [planHostEscrowRow, setPlanHostEscrowRow] = useState<DbEscrowTransaction | null>(null);
  const [dispute, setDispute] = useState<DbEscrowDispute | null>(null);
  const [counterparty, setCounterparty] = useState<EscrowParty | null>(null);
  const [loadDone, setLoadDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [fundConfirmOpen, setFundConfirmOpen] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'card' | 'bank_transfer' | null
  >(null);
  const [safetyCaveatOpen, setSafetyCaveatOpen] = useState(false);
  const [escrowPolicyOpen, setEscrowPolicyOpen] = useState(false);
  const [pendingFundAfterPolicy, setPendingFundAfterPolicy] = useState(false);
  const insets = useSafeAreaInsets();
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [hostName, setHostName] = useState('Host');
  const [guestName, setGuestName] = useState('Guest');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [awaitingFulfillment, setAwaitingFulfillment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{
    variant: AppFeedbackVariant;
    kicker?: string;
    title: string;
    message: string;
    primaryLabel?: string;
    onPrimary?: () => void;
  } | null>(null);
  const [checkAgainBusy, setCheckAgainBusy] = useState(false);
  const [stillProcessingOpen, setStillProcessingOpen] = useState(false);
  const [activeCheckoutRef, setActiveCheckoutRef] = useState<string | null>(null);
  const confirmingPaymentRef = useRef(false);
  const pendingCheckoutRef = useRef<string | null>(null);
  const resumeSettlementKeyRef = useRef<string | null>(null);
  const actionLock = useRef(false);
  const loadInFlightRef = useRef(false);
  const loadedForIdRef = useRef<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!id || !isSupabaseConfigured || !user?.id) {
      setLoadDone(true);
      return;
    }
    if (loadInFlightRef.current) return;

    const silent = options?.silent ?? loadedForIdRef.current === id;
    loadInFlightRef.current = true;
    if (!silent) {
      setLoadDone(false);
    }
    try {
      const { data: eRow } = await supabase.from('escrow_transactions').select('*').eq('id', id).single();
      if (!eRow) {
        setEscrow(null);
        setPlan(null);
        setGuestEscrowRows([]);
        setAcceptedGuestOffers([]);
        setPlanHostEscrowRow(null);
        setDispute(null);
        setCounterparty(null);
        return;
      }
      const esc = eRow as DbEscrowTransaction;

      const partyIds = [esc.host_id, esc.guest_id].filter(Boolean) as string[];
      const cpId =
        esc.host_id && esc.guest_id
          ? user.id === esc.host_id
            ? esc.guest_id
            : esc.host_id
          : user.id === esc.payer_id
            ? esc.payee_id
            : esc.payer_id;

      const [{ data: pRow }, { data: dRow }, profsRes] = await Promise.all([
        supabase.from('plans').select('*').eq('id', esc.plan_id).single(),
        supabase
          .from('escrow_disputes')
          .select('*')
          .eq('escrow_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        partyIds.length
          ? supabase
              .from('profiles')
              .select('user_id, display_name, avatar_url, verified_badge')
              .in('user_id', partyIds)
          : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; avatar_url: string | null; verified_badge: boolean | null }[] }),
      ]);

      const planRow = pRow ? (pRow as DbPlan) : null;
      let guestRows: DbEscrowTransaction[] = [];
      let acceptedOffers: Pick<DbPlanOffer, 'current_amount_cents' | 'amount_cents'>[] = [];
      let hostEscrowRow: DbEscrowTransaction | null = null;
      if (planRow && isGroupSplitPlan(planRow)) {
        const hostEscrowId = planRow.host_escrow_id ?? null;
        const [{ data: guestEsc }, { data: offerRows }, hostEscRes] = await Promise.all([
          supabase
            .from('escrow_transactions')
            .select('*')
            .eq('plan_id', esc.plan_id)
            .not('guest_id', 'is', null),
          supabase
            .from('plan_offers')
            .select('current_amount_cents, amount_cents')
            .eq('plan_id', esc.plan_id)
            .eq('status', 'accepted'),
          hostEscrowId && hostEscrowId !== esc.id
            ? supabase.from('escrow_transactions').select('*').eq('id', hostEscrowId).maybeSingle()
            : Promise.resolve({ data: hostEscrowId === esc.id ? esc : null }),
        ]);
        guestRows = (guestEsc ?? []) as DbEscrowTransaction[];
        acceptedOffers = (offerRows ?? []) as Pick<
          DbPlanOffer,
          'current_amount_cents' | 'amount_cents'
        >[];
        hostEscrowRow =
          hostEscrowId === esc.id
            ? esc
            : hostEscRes.data
              ? (hostEscRes.data as DbEscrowTransaction)
              : null;
      }
      setGuestEscrowRows(guestRows);
      setAcceptedGuestOffers(acceptedOffers);
      setPlanHostEscrowRow(hostEscrowRow);

      setEscrow(esc);
      if (
        esc.status === 'pending_funding' &&
        user?.id &&
        escrowPaymentInitiated(esc) &&
        !escrowCheckoutReturned(esc) &&
        escrowCheckoutInitiator(esc) === user.id
      ) {
        await clearEscrowCheckoutPending(supabase, esc.id);
        const { data: refreshed } = await supabase
          .from('escrow_transactions')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (refreshed) {
          setEscrow(refreshed as DbEscrowTransaction);
        }
      } else if (esc.status !== 'pending_funding') {
        setAwaitingFulfillment(false);
      }
      setPlan(planRow);
      setDispute(dRow ? (dRow as DbEscrowDispute) : null);

      const profs = profsRes.data ?? [];
      const profMap = new Map(profs.map((p) => [p.user_id as string, p]));
      if (esc.host_id) {
        setHostName(profMap.get(esc.host_id)?.display_name ?? 'Host');
      }
      if (esc.guest_id) {
        setGuestName(profMap.get(esc.guest_id)?.display_name ?? 'Guest');
      }

      const prof = profMap.get(cpId);
      if (prof) {
        setCounterparty({
          name: prof.display_name ?? 'Member',
          avatarUrl: prof.avatar_url,
          verified: !!prof.verified_badge,
        });
      } else {
        setCounterparty({ name: 'Member', avatarUrl: null, verified: false });
      }
    } finally {
      loadedForIdRef.current = id;
      loadInFlightRef.current = false;
      setLoadDone(true);
    }
  }, [id, user?.id]);

  useEffect(() => {
    loadedForIdRef.current = null;
  }, [id]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const confirmCheckoutRef =
    activeCheckoutRef ?? escrowCheckoutReference(escrow) ?? escrow?.payment_tx_ref ?? null;

  const hostViewingGuestLegEarly = useMemo(() => {
    if (!escrow || !user?.id || user.id !== escrow.host_id) return false;
    if (!plan || !isGroupSplitPlan(plan)) return false;
    return escrow.guest_id != null && !isGroupHostCloseEscrowRow(plan, escrow);
  }, [escrow, plan, user?.id]);

  const confirmPaymentEnabled = useMemo(() => {
    if (!escrow || !user?.id || hostViewingGuestLegEarly) return false;
    const funded =
      escrow.status === 'funded' ||
      escrow.status === 'active' ||
      escrow.status === 'released';
    if (funded || escrow.status !== 'pending_funding') return false;
    if (!escrowAwaitingFulfillment(escrow)) return false;
    const initiator = escrowCheckoutInitiator(escrow);
    return (
      initiator === user.id ||
      (!initiator && getEscrowFundingUiState(escrow, user.id).canFund)
    );
  }, [escrow, hostViewingGuestLegEarly, user?.id]);

  const onEscrowVerified = useCallback(() => {
    setAwaitingFulfillment(false);
    pendingCheckoutRef.current = null;
    setActiveCheckoutRef(null);
    void load({ silent: true });
  }, [load]);

  const { status: confirmationStatus, secondsElapsed, retryVerify } = useEscrowConfirmation(
    supabase,
    escrow?.id,
    {
      enabled: confirmPaymentEnabled,
      txRef: confirmCheckoutRef,
      userId: user?.id,
      onVerified: onEscrowVerified,
    }
  );

  useFocusEffect(
    useCallback(() => {
      void load({ silent: loadedForIdRef.current === id });
    }, [load, id])
  );

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    const channel = supabase.channel(
      `escrow:${id}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
    );
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escrow_transactions',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const next = payload.new as DbEscrowTransaction;
          setEscrow((prev) => {
            if (!prev) return next;
            const becameFullyFunded = prev.status !== 'funded' && next.status === 'funded';
            const legAdvanced =
              next.escrow_pattern === 'B' &&
              ((!prev.host_funded_at && next.host_funded_at) ||
                (!prev.guest_funded_at && next.guest_funded_at));
            if ((becameFullyFunded || legAdvanced) && !confirmingPaymentRef.current) {
              setAwaitingFulfillment(false);
              const feedback = escrowPaymentConfirmedMessage(next, user?.id);
              setPaymentFeedback({
                variant: 'success',
                title: feedback.title,
                message: feedback.message,
              });
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!escrow?.plan_id || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`escrow-plan:${escrow.plan_id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plans',
          filter: `id=eq.${escrow.plan_id}`,
        },
        (payload) => {
          setPlan(payload.new as DbPlan);
          void loadRef.current({ silent: true });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [escrow?.plan_id]);

  useEffect(() => {
    if (!escrow?.plan_id || !plan?.is_group_plan || !isSupabaseConfigured) return;
    return subscribeEscrowRealtime({
      planId: escrow.plan_id,
      onRefresh: () => {
        void loadRef.current({ silent: true });
      },
    });
  }, [escrow?.plan_id, plan?.is_group_plan]);

  useEffect(() => {
    if (!escrow?.plan_id || !user?.id) return;
    if (!isEscrowFullyFundedForMeet(escrow)) return;
    const counterpartyId =
      user.id === escrow.host_id
        ? escrow.guest_id
        : user.id === escrow.guest_id
          ? escrow.host_id
          : null;
    void needsSafetyCaveatGate(escrow.plan_id, user.id, counterpartyId).then((needs) => {
      if (needs) setSafetyCaveatOpen(true);
    });
  }, [escrow, user?.id]);

  useEffect(() => {
    if (!escrow || escrow.status !== 'pending_funding' || confirmingPayment || !user?.id) return;
    if (!escrowAwaitingFulfillment(escrow)) return;
    const ref = pendingCheckoutRef.current ?? escrowCheckoutReference(escrow);
    if (!ref) return;
    const key = `${escrow.id}:${ref}`;
    if (resumeSettlementKeyRef.current === key) return;
    resumeSettlementKeyRef.current = key;
    pendingCheckoutRef.current = ref;
    setConfirmingPayment(true);
    confirmingPaymentRef.current = true;
    setAwaitingFulfillment(true);
    void resumeEscrowSettlementIfNeeded(supabase, escrow, user.id).then(async ({ ran, result }) => {
      if (ran) {
        await load();
        if (result?.funded || result?.partial) {
          setAwaitingFulfillment(false);
          if (escrow) {
            const { data: fresh } = await supabase
              .from('escrow_transactions')
              .select('*')
              .eq('id', escrow.id)
              .maybeSingle();
            const row = (fresh as DbEscrowTransaction | null) ?? escrow;
            const feedback = escrowPaymentConfirmedMessage(row, user.id);
            setPaymentFeedback({
              variant: 'success',
              title: feedback.title,
              message: feedback.message,
            });
          }
        }
      }
      setConfirmingPayment(false);
      confirmingPaymentRef.current = false;
    });
  }, [escrow?.id, escrow?.status, escrow?.metadata, confirmingPayment, load, user?.id]);

  useEffect(() => {
    if (!escrow || !user?.id) return;
    if (isUserEscrowLegFunded(escrow, user.id) || confirmationStatus === 'verified') {
      setAwaitingFulfillment(false);
      setConfirmingPayment(false);
      confirmingPaymentRef.current = false;
    }
    if (escrow.status === 'funded' || escrow.status === 'active' || escrow.status === 'released') {
      setAwaitingFulfillment(false);
      pendingCheckoutRef.current = null;
    }
  }, [
    escrow?.host_funded_at,
    escrow?.guest_funded_at,
    escrow?.status,
    user?.id,
    confirmationStatus,
  ]);

  const timelineItems = useMemo(() => {
    if (!escrow) return [];
    return buildEscrowTimeline(escrow, plan, dispute, { host: hostName, guest: guestName });
  }, [escrow, plan, dispute, hostName, guestName]);

  const openChatWithCounterparty = useCallback(async () => {
    if (!user || !escrow) return;
    const other =
      escrow.host_id && escrow.guest_id
        ? user.id === escrow.host_id
          ? escrow.guest_id
          : escrow.host_id
        : escrow.payer_id === user.id
          ? escrow.payee_id
          : escrow.payer_id;
    try {
      await openDirectChat(supabase, user.id, other, { skipOfferGate: true });
    } catch (e) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Could not open chat');
    }
  }, [user, escrow]);

  async function onCheckPaymentAgain() {
    if (!escrow) return;
    setCheckAgainBusy(true);
    try {
      const funded = await retryVerify();
      if (funded) {
        onEscrowVerified();
        return;
      }
      const result = await invokeVerifyEscrowPayment(
        supabase,
        escrow.id,
        confirmCheckoutRef ?? undefined
      );
      if (result.funded || result.partial) {
        onEscrowVerified();
      } else {
        setStillProcessingOpen(true);
      }
    } finally {
      setCheckAgainBusy(false);
    }
  }

  const goToPlan = useCallback(() => {
    if (!escrow) return;
    router.replace(`/plan/${escrow.plan_id}` as Href);
  }, [escrow?.plan_id]);

  async function runLocked(fn: () => Promise<void>) {
    if (actionLock.current || busy) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      actionLock.current = false;
    }
  }

  function requireVerified(): boolean {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return false;
    }
    return true;
  }

  async function settlePayment(txRef: string, fromResume = false) {
    if (!escrow || !txRef) return;
    setConfirmingPayment(true);
    confirmingPaymentRef.current = true;
    setAwaitingFulfillment(true);
    setPaymentFeedback(null);
    try {
      const result = await settleEscrowCheckout(supabase, escrow.id, txRef, {
        confirmAttempts: fromResume ? 4 : 6,
        pollAttempts: 30,
        pollIntervalMs: 1500,
      });
      await load();
      if (result.funded) {
        setAwaitingFulfillment(false);
        pendingCheckoutRef.current = null;
        setPaymentFeedback({
          variant: 'success',
          title: 'Escrow funded',
          message: 'Payment confirmed. Your plan is now active.',
        });
      } else if (result.partial) {
        setAwaitingFulfillment(false);
        pendingCheckoutRef.current = null;
        setPaymentFeedback({
          variant: 'success',
          title: 'Share received',
          message:
            'Your payment was recorded. Waiting for the other person to complete their share.',
        });
      }
      // If still pending: webhook/realtime will finish — no manual refresh modal.
    } finally {
      setConfirmingPayment(false);
      confirmingPaymentRef.current = false;
    }
  }

  async function handleCheckoutReturn(txRef: string) {
    await settlePayment(txRef, false);
  }

  async function handleCardPayment() {
    setFundConfirmOpen(false);
    if (!escrow || !user?.email || !requireVerified()) return;
    await runLocked(async () => {
      let amountKobo = escrow.amount_cents;
      let escrowLeg: 'host' | 'guest' | undefined;
      if (escrow.escrow_pattern === 'B') {
        const splitFundingUi = getEscrowFundingUiState(escrow, user.id);
        if (user.id === escrow.host_id && !escrow.host_funded_at) {
          escrowLeg = 'host';
        } else if (user.id === escrow.guest_id && !escrow.guest_funded_at) {
          escrowLeg = 'guest';
        } else {
          Alert.alert('Payment', 'No pending share for you on this escrow.');
          return;
        }
        amountKobo = splitFundingUi.payAmountCents;
        if (amountKobo <= 0) {
          Alert.alert('Payment', 'Invalid split amount.');
          return;
        }
      } else {
        const fundingUi = getEscrowFundingUiState(escrow, user.id);
        if (!fundingUi.canFund) {
          Alert.alert('Payment', 'No pending payment for you on this escrow.');
          return;
        }
        amountKobo = fundingUi.payAmountCents;
      }

      const opened = await openEscrowCheckout(
        {
          email: user.email ?? '',
          amountKobo,
          escrowId: escrow.id,
          planId: escrow.plan_id,
          escrowLeg,
        },
        { deferBrowser: true }
      );
      if (!opened.ok || !opened.url || !opened.returnUrl) {
        setPaymentFeedback({
          variant: 'error',
          kicker: 'Payment',
          title: "Couldn't open checkout",
          message: opened.error ?? 'We could not start Flutterwave checkout. Please try again.',
        });
        return;
      }

      pendingCheckoutRef.current = opened.reference;
      setActiveCheckoutRef(opened.reference);

      const browser = await openFlutterwaveCheckoutInBrowser(opened.url, opened.returnUrl);
      if (!browser.ok) {
        pendingCheckoutRef.current = null;
        setActiveCheckoutRef(null);
        setAwaitingFulfillment(false);
        setConfirmingPayment(false);
        confirmingPaymentRef.current = false;
        await clearEscrowCheckoutPending(supabase, escrow.id);
        await load();
        setPaymentFeedback({
          variant: 'warning',
          kicker: 'Payment',
          title: 'Checkout cancelled',
          message:
            browser.error ??
            'Payment was not completed. Your share is still unpaid — tap Pay your share when you are ready to try again.',
        });
        return;
      }

      await recordEscrowPaymentInitiated(supabase, escrow.id, opened.reference, user.id);
      await handleCheckoutReturn(opened.reference);
    });
  }

  function handleFundEscrow() {
    void (async () => {
      if (!escrow?.plan_id || !user?.id) {
        setSelectedPaymentMethod(null);
        setShowMethodSelector(true);
        return;
      }
      const signed = await hasEscrowPolicySignoff(escrow.plan_id, user.id);
      if (!signed) {
        setPendingFundAfterPolicy(true);
        setEscrowPolicyOpen(true);
        return;
      }
      setSelectedPaymentMethod(null);
      setShowMethodSelector(true);
    })();
  }

  function continueAfterEscrowPolicy() {
    setEscrowPolicyOpen(false);
    if (pendingFundAfterPolicy) {
      setPendingFundAfterPolicy(false);
      setSelectedPaymentMethod(null);
      setShowMethodSelector(true);
    }
  }

  async function handleMethodConfirmed() {
    setShowMethodSelector(false);
    if (selectedPaymentMethod === 'card') {
      await handleCardPayment();
    } else if (selectedPaymentMethod === 'bank_transfer' && escrow) {
      router.push(`/escrow/bank-transfer/${escrow.id}` as Href);
    }
  }

  async function onConfirmFund() {
    await handleCardPayment();
  }

  async function onDemoFunded() {
    if (!escrow) return;
    if (!requireVerified()) return;
    await runLocked(async () => {
      const { error } = await markEscrowFunded(supabase, escrow, `demo-${Date.now()}`);
      if (error) Alert.alert('Escrow', error);
      else void load();
    });
  }

  async function onConfirmMeetupComplete() {
    setCompleteConfirmOpen(false);
    if (!plan || !user || !escrow) return;
    if (!isEscrowFullyFundedForMeet(escrow)) {
      setPaymentFeedback({
        variant: 'warning',
        title: 'Payment pending',
        message:
          escrow.escrow_pattern === 'B'
            ? 'Both parties must fund their share before the meetup can proceed.'
            : 'Please fund escrow before proceeding.',
      });
      return;
    }
    if (plan.status !== 'active' && plan.status !== 'completed') {
      setPaymentFeedback({
        variant: 'warning',
        title: 'Plan not active',
        message: 'The plan must be active before you can confirm the meetup.',
      });
      return;
    }
    await runLocked(async () => {
      const { error } = await confirmMeetupComplete(supabase, plan.id, user.id);
      if (error) Alert.alert('Plan', error);
      else void load();
    });
  }

  async function onConfirmRelease() {
    setReleaseConfirmOpen(false);
    if (!escrow || !plan) return;
    await runLocked(async () => {
      const { error } = await releaseEscrowFunds(supabase, escrow.id, plan.id, plan.status);
      if (error) Alert.alert('Release', error);
      else void load();
    });
  }

  async function onDisputeSubmit(reasonId: string, reasonLabel: string, detail: string) {
    if (!escrow || !plan || !user) return;
    await runLocked(async () => {
      const { error } = await openEscrowDisputeWithTicket(supabase, {
        escrowId: escrow.id,
        planId: plan.id,
        userId: user.id,
        reasonCode: reasonId,
        reasonLabel,
        detail,
      });
      if (error) Alert.alert('Dispute', error);
      else {
        setDisputeOpen(false);
        void load();
        if (dbUser?.subscription_tier === 'PLATINUM') {
          Alert.alert(
            'Dispute submitted',
            'As a Platinum member, your dispute will be reviewed within 36 hours.'
          );
        }
        router.push('/support' as Href);
      }
    });
  }

  if (!user || !loadDone) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          {user ? <EscrowScreenHeader /> : null}
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <PlanFlowScreenSkeleton />
          </ScrollView>
        </View>
      </Screen>
    );
  }

  if (!escrow) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <DiscoveryGradientBg />
          <EscrowScreenHeader />
          <View style={styles.fallbackPad}>
            <Text style={styles.fallbackTxt}>This escrow could not be loaded.</Text>
            <Pressable onPress={() => goBackOrFallback()} style={styles.fallbackBtn}>
              <Text style={styles.fallbackBtnTxt}>Go back</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  const fundingUi = getEscrowFundingUiState(escrow, user.id);
  const patternB = escrow.escrow_pattern === 'B';
  const patternA = escrow.escrow_pattern === 'A';
  const patternC = escrow.escrow_pattern === 'C';
  const isGroupSplit = plan ? isGroupSplitPlan(plan) : false;
  const isHost = user.id === escrow.host_id;
  const groupHostShareOptions = {
    acceptedOffers: acceptedGuestOffers,
    hostEscrowRow: planHostEscrowRow,
  };
  const groupHostShare =
    isGroupSplit && isHost && plan
      ? resolveGroupHostShareCents(plan, escrow, guestEscrowRows, groupHostShareOptions)
      : null;
  const isGroupHostLegRow =
    isGroupSplit && isHost && plan ? isGroupHostCloseEscrowRow(plan, escrow) : false;
  const hostViewingGuestLeg =
    isGroupSplit && isHost && escrow.guest_id != null && !isGroupHostLegRow;
  const currentUserPayCents = resolveCurrentUserPayCents(escrow, user.id, {
    groupHostShare,
    hostEscrowId: plan?.host_escrow_id ?? null,
    isHostCloseRow: isGroupHostLegRow,
  });
  const resolvedHostShareCents = Math.max(
    groupHostShare?.displayCents ?? 0,
    groupHostShare?.paymentCents ?? 0
  );
  const myShareCents =
    isGroupSplit && isHost
      ? hostViewingGuestLeg
        ? Math.max(0, escrow.guest_share_cents ?? escrow.amount_cents ?? 0)
        : resolvedHostShareCents > 0
          ? resolvedHostShareCents
          : currentUserPayCents
      : currentUserPayCents;
  const myPayShareCents =
    isGroupSplit && isHost && !hostViewingGuestLeg
      ? resolvedHostShareCents > 0
        ? resolvedHostShareCents
        : currentUserPayCents
      : currentUserPayCents;
  const myLegFunded = isUserEscrowLegFunded(escrow, user.id);
  const canFundThisLeg =
    fundingUi.canFund ||
    (isGroupSplit &&
      isHost &&
      groupHostShare != null &&
      myPayShareCents > 0 &&
      isGroupHostLegRow &&
      !myLegFunded &&
      escrow.status === 'pending_funding');
  const escrowFullyFunded = isEscrowFullyFundedForMeet(escrow);
  const escrowFunded =
    escrowFullyFunded ||
    escrow.status === 'active' ||
    escrow.status === 'released';
  const planKind = plan?.is_group_plan ? 'group' : plan?.is_mood_plan ? 'mood' : 'standard';
  const splitRatioLabel =
    plan?.host_contribution_bps != null
      ? `${Math.round(plan.host_contribution_bps / 100)}% host / ${100 - Math.round(plan.host_contribution_bps / 100)}% guest`
      : null;
  const escrowPhase = deriveEscrowPhase({
    isGroupSplit,
    isHost,
    hostEscrowId: plan?.host_escrow_id ?? null,
    myEscrowStatus: escrow.status ?? null,
    planStatus: plan?.status ?? null,
    planTier: plan?.is_paid ? 'paid' : 'free',
    userLegFunded: myLegFunded,
  });
  const screenContent = resolveEscrowScreenContent({
    screen: 'secure_payment',
    planTier: plan?.is_paid ? 'paid' : 'free',
    planKind,
    pattern: (plan?.escrow_pattern ?? escrow.escrow_pattern) as 'A' | 'B' | 'C' | null,
    role: isHost ? 'host' : 'guest',
    phase: escrowPhase,
    isGroupSplit,
    splitRatioLabel,
    counterpartyName: isHost ? guestName : hostName,
    userLegFunded: myLegFunded,
  });
  const userPaymentConfirmed =
    myLegFunded || confirmationStatus === 'verified';
  const paymentConfirmedCopy =
    isGroupSplit && userPaymentConfirmed
      ? myLegFunded && !escrowFullyFunded
        ? {
            title: 'Your share funded',
            message: isHost
              ? 'Your payment is confirmed. The plan activates once all guest shares are funded.'
              : 'Your slot is secured. The plan activates after all guests and the host have funded their shares.',
          }
        : escrowPaymentConfirmedMessage(escrow, user.id)
      : escrowPaymentConfirmedMessage(escrow, user.id);
  const showPaymentConfirmedFooter =
    userPaymentConfirmed && escrowCheckoutReturned(escrow) && !escrowFunded;
  const paymentPendingConfirmation =
    confirmPaymentEnabled &&
    !userPaymentConfirmed &&
    !escrowFunded &&
    (confirmationStatus === 'polling' ||
      confirmationStatus === 'timeout' ||
      confirmingPayment ||
      awaitingFulfillment);
  const showFund =
    canFundThisLeg &&
    !hostViewingGuestLeg &&
    screenContent.showPaymentButton &&
    !paymentPendingConfirmation &&
    !showPaymentConfirmedFooter &&
    !escrowFunded &&
    (!isGroupSplit || !isHost || myPayShareCents > 0);
  const showWaitingCard =
    !confirmingPayment &&
    (screenContent.waitingCopy != null
      ? myLegFunded || !fundingUi.canFund
      : fundingUi.waitingForCounterparty);
  const stepIdx = stepActiveIndex(escrow, plan);
  const whenLabel = formatIsoDateTime(plan?.agreed_scheduled_at, plan?.scheduled_at ?? undefined);
  const locationLabel = plan?.agreed_location ?? plan?.location_label ?? 'Not set';
  const amountLabel = formatEscrowMoney(escrow.amount_cents, escrow.currency);
  const summaryLegAmountCents = resolveEscrowRowLegAmountCents(escrow, {
    viewerId: user.id,
    groupHostShare,
    hostEscrowId: plan?.host_escrow_id ?? null,
    isHostCloseRow: isGroupHostLegRow,
  });
  const legAmountLabel = formatEscrowMoney(summaryLegAmountCents, escrow.currency);
  const showSummaryTotalHeld = summaryLegAmountCents !== escrow.amount_cents;
  const userPayGrossCents =
    fundingUi.payAmountCents > 0 ? fundingUi.payAmountCents : currentUserPayCents;
  const yourShareLabel =
    userPayGrossCents > 0 ? formatEscrowMoney(userPayGrossCents, escrow.currency) : null;
  const fundConfirmAmountLabel = yourShareLabel ?? amountLabel;
  const userPaymentStatusLabel = getUserPaymentStatusLabel(escrow, user.id, {
    confirmingPayment: paymentPendingConfirmation || confirmingPayment,
    hostName,
    guestName,
  });
  const userEscrowBadge = getUserEscrowBadgeDisplay(escrow, user.id, {
    confirmingPayment: paymentPendingConfirmation || confirmingPayment,
    hostName,
    guestName,
  });
  const planTitleSuffix = plan?.is_group_plan
    ? ' · Group Plan'
    : plan?.is_mood_plan
      ? ' · Mood Plan'
      : '';
  const meetupIso = plan?.agreed_scheduled_at ?? plan?.scheduled_at ?? null;
  const meetupSoonPending = escrow.status === 'pending_funding' && isMeetupWithinHours(meetupIso, 48);
  const meetupWhenLabel = meetupHoursUntilLabel(meetupIso);
  const groupSplitTotalOpts = {
    acceptedOffers: acceptedGuestOffers,
    hostEscrowRow: planHostEscrowRow,
  };
  const planTotalCents =
    isGroupSplit && plan
      ? resolveGroupPlanTotalCents(plan, guestEscrowRows, groupSplitTotalOpts)
      : 0;
  const guestsCommittedCents =
    isGroupSplit && plan
      ? resolveAcceptedGuestCommitmentCents(plan, guestEscrowRows, acceptedGuestOffers)
      : 0;
  const hostShareDisplayCents =
    groupHostShare?.displayCents ??
    Math.max(0, planHostEscrowRow?.host_share_cents ?? 0);
  const hostSharePayGrossCents =
    groupHostShare?.paymentCents ??
    (planHostEscrowRow ? patternBLegGrossCents(planHostEscrowRow, 'host') : 0);
  const groupClosed = !!plan?.group_closed_at;
  const hostShareFunded =
    !!planHostEscrowRow?.host_funded_at ||
    planHostEscrowRow?.status === 'funded' ||
    planHostEscrowRow?.status === 'active' ||
    planHostEscrowRow?.status === 'released';
  const trustNote =
    screenContent.trustNote ??
    'Your payment is secure and stays in escrow until you confirm the meetup completed successfully.';
  const fundCtaSubtitle = screenContent.fundCtaSubtitle
    ? yourShareLabel
      ? `Your share: ${yourShareLabel} · ${screenContent.fundCtaSubtitle}`
      : screenContent.fundCtaSubtitle
    : `Total held: ${formatEscrowMoney(escrow.amount_cents, escrow.currency)} via Flutterwave`;
  const fundCtaTitle = screenContent.fundCtaLabel ?? fundingUi.fundCtaTitle;

  const disputed = escrow.status === 'disputed';
  const showWaitingFunded =
    escrowFullyFunded && plan?.status === 'active' && !disputed;
  const showReleaseBlock =
    escrowFullyFunded && escrow.status === 'funded' && plan?.status === 'completed' && !disputed;
  const showDisputedBanner = disputed;

  const returnToPlanCta = (containerStyle?: object) => (
    <Pressable
      onPress={goToPlan}
      style={({ pressed }) => [
        styles.messageCtaOuter,
        { marginBottom: 0 },
        containerStyle,
        pressed && { opacity: 0.92 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Return to plan"
    >
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.messageCtaRing}
      >
        <View style={styles.messageCtaInner}>
          <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
          <Text style={styles.messageCtaText} numberOfLines={1}>
            Return to plan
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <DiscoveryGradientBg />
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title="Verification required"
        message="Only verified members can fund escrow or complete secure payments on LinkUp."
      />
      <AppFeedbackModal
        visible={paymentFeedback != null}
        onClose={() => setPaymentFeedback(null)}
        variant={paymentFeedback?.variant ?? 'warning'}
        kicker={paymentFeedback?.kicker ?? 'LinkUp'}
        title={paymentFeedback?.title ?? ''}
        message={paymentFeedback?.message ?? ''}
        primaryLabel={paymentFeedback?.primaryLabel ?? 'Got it'}
        onPrimary={paymentFeedback?.onPrimary}
      />
      <AppFeedbackModal
        visible={stillProcessingOpen}
        onClose={() => setStillProcessingOpen(false)}
        variant="warning"
        kicker="Secure payment"
        title="Still processing"
        message="Your payment is confirmed with Flutterwave. We're still applying it to escrow. This can take a minute. You can wait here or check back from your plan."
        primaryLabel="Go to plan"
        onPrimary={() => {
          setStillProcessingOpen(false);
          if (escrow) router.replace(`/plan/${escrow.plan_id}` as Href);
        }}
        secondaryLabel="Stay on escrow"
        onSecondary={() => setStillProcessingOpen(false)}
        dismissOnBackdrop
      />
      <EscrowConfirmModal
        visible={fundConfirmOpen}
        title="Open secure checkout?"
        message={`You'll pay ${fundConfirmAmountLabel} via Flutterwave. Funds stay in escrow until the meetup is confirmed or a dispute is resolved.`}
        confirmLabel="Continue"
        cancelLabel="Not now"
        onCancel={() => setFundConfirmOpen(false)}
        onConfirm={() => void onConfirmFund()}
        confirmVariant="primary"
      />
      {escrowPolicyOpen && escrow?.plan_id && user?.id ? (
        <EscrowPolicySignOffModal
          visible={escrowPolicyOpen}
          planId={escrow.plan_id}
          userId={user.id}
          escrowPattern={escrow.escrow_pattern}
          onSigned={continueAfterEscrowPolicy}
        />
      ) : null}
      {safetyCaveatOpen && escrow?.plan_id && user?.id ? (
        <SafetyCaveatInterstitial
          planId={escrow.plan_id}
          userId={user.id}
          onAcknowledged={() => setSafetyCaveatOpen(false)}
        />
      ) : null}
      <EscrowConfirmModal
        visible={completeConfirmOpen}
        title="Mark meetup complete?"
        message="Only confirm if the plan happened as agreed. The other person will be able to request fund release."
        confirmLabel="Yes, we completed it"
        cancelLabel="Cancel"
        onCancel={() => setCompleteConfirmOpen(false)}
        onConfirm={() => void onConfirmMeetupComplete()}
        confirmVariant="primary"
      />
      <EscrowConfirmModal
        visible={releaseConfirmOpen}
        title="Release funds?"
        message={`This pays out the held amount to the ${escrow?.escrow_pattern === 'C' ? 'host' : 'guest'}. This cannot be undone from the app.`}
        confirmLabel="Release now"
        cancelLabel="Cancel"
        onCancel={() => setReleaseConfirmOpen(false)}
        onConfirm={() => void onConfirmRelease()}
        confirmVariant="danger"
      />
      <OpenDisputeModal
        visible={disputeOpen}
        loading={busy}
        onClose={() => setDisputeOpen(false)}
        onSubmit={(rid, lbl, d) => void onDisputeSubmit(rid, lbl, d)}
      />

      <EscrowScreenHeader />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          showFund ? styles.scrollWithFooter : paymentPendingConfirmation || showPaymentConfirmedFooter ? styles.scrollWithFooter : null,
        ]}
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
            <Text style={styles.leadKicker}>Escrow</Text>
            <Text style={styles.leadTitle}>
              {showPaymentConfirmedFooter
                ? paymentConfirmedCopy.title
                : paymentPendingConfirmation
                  ? 'Confirming payment'
                  : showFund
                    ? 'Complete payment'
                    : escrowFunded
                      ? 'Escrow funded'
                      : 'Secure hold'}
            </Text>
            <Text style={styles.leadSub}>
              {showPaymentConfirmedFooter
                ? paymentConfirmedCopy.message
                : paymentPendingConfirmation
                  ? 'Hang tight while we verify your Flutterwave payment and update escrow.'
                  : showFund
                    ? 'This is the payment screen. Flutterwave checkout opens when you tap below.'
                    : escrowFunded
                      ? 'Your payment is held securely until the meetup is confirmed.'
                      : 'Track funding, meetup, and release in one place.'}
            </Text>
          </View>
        </View>

        {meetupSoonPending && meetupWhenLabel ? (
          <View style={styles.meetupUrgent}>
            <Ionicons name="alarm-outline" size={20} color={colors.warning} />
            <Text style={styles.meetupUrgentTxt}>
              Meetup {meetupWhenLabel}. {showFund ? 'Fund escrow now' : 'Complete funding soon'} so you&apos;re covered.
            </Text>
          </View>
        ) : null}

        {counterparty ? (
          <EscrowCounterpartyHeader
            title={`${plan?.title ?? 'Paid plan'}${planTitleSuffix}`}
            counterparty={counterparty}
            youLabel={
              patternB
                ? isGroupSplit
                  ? fundingUi.canFund
                    ? isHost
                      ? 'Your host share is due'
                      : 'Your agreed share is due'
                    : 'Group split escrow'
                  : fundingUi.canFund
                    ? 'Your share is due'
                    : 'Split escrow'
                : patternA
                  ? fundingUi.canFund
                    ? 'You are paying (host)'
                    : fundingUi.waitingForCounterparty
                      ? 'Waiting for host'
                      : 'Host-funded escrow'
                  : patternC
                    ? fundingUi.canFund
                      ? 'You are paying (guest)'
                      : fundingUi.waitingForCounterparty
                        ? 'Waiting for guest'
                        : 'Guest-funded escrow'
                    : fundingUi.canFund
                      ? 'You are paying'
                      : ''
            }
          />
        ) : null}

        <Pressable
          onPress={() => void openChatWithCounterparty()}
          style={({ pressed }) => [styles.messageCtaOuter, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Message counterparty"
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
                Message {counterparty?.name ?? 'counterparty'}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.badgeRow}>
          <EscrowStatusBadge
            status={userEscrowBadge.status}
            label={userEscrowBadge.label}
          />
        </View>

        <EscrowStepIndicator activeIndex={stepIdx} />

        {screenContent.showMoodDeadlineBanner &&
        escrow.status === 'pending_funding' &&
        escrow.funding_deadline &&
        !showDisputedBanner ? (
          <FundingDeadlineUrgencyBanner
            deadlineIso={escrow.funding_deadline}
            isMoodPlan={!!plan?.is_mood_plan}
          />
        ) : null}

        {showDisputedBanner ? (
          <View style={styles.warnBanner}>
            <Ionicons name="alert-circle" size={22} color={colors.danger} />
            <Text style={styles.warnTxt}>Dispute in progress. Payment actions are paused while we review.</Text>
          </View>
        ) : null}

        <EscrowSummaryCard
          totalHeldLabel={amountLabel}
          paymentStatusLabel={userPaymentStatusLabel}
          whenLabel={whenLabel}
          locationLabel={locationLabel}
          trustNote={trustNote}
          legAmountLabel={legAmountLabel}
          showTotalHeld={showSummaryTotalHeld}
        />

        {plan?.is_paid && escrow.amount_cents > 0 ? (
          <View style={styles.feeBreakdownCard}>
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabel}>Plan contribution</Text>
              <Text style={styles.feeBreakdownAmount}>
                {formatEscrowMoney(budgetFromGrossAmountCents(escrow.amount_cents), escrow.currency)}
              </Text>
            </View>
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabel}>Platform fee (5%)</Text>
              <Text style={styles.feeBreakdownGoodwill}>
                {formatEscrowMoney(feeFromGrossAmountCents(escrow.amount_cents), escrow.currency)}
              </Text>
            </View>
            <View style={[styles.feeBreakdownRow, styles.feeBreakdownTotal]}>
              <Text style={styles.feeBreakdownLabelBold}>Total you pay</Text>
              <Text style={styles.feeBreakdownAmountBold}>
                {formatEscrowMoney(escrow.amount_cents, escrow.currency)}
              </Text>
            </View>
          </View>
        ) : null}

        {escrow.status === 'released' && (escrow.goodwill_applied_cents ?? 0) > 0 ? (
          <View style={styles.feeBreakdownCard}>
            <Text style={styles.feeBreakdownTitle}>Fee breakdown</Text>
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabel}>Platform fee</Text>
              <Text style={styles.feeBreakdownStrike}>
                {formatEscrowMoney(feeFromGrossAmountCents(escrow.amount_cents), escrow.currency)}
              </Text>
            </View>
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabelGoodwill}>Goodwill credit applied</Text>
              <Text style={styles.feeBreakdownGoodwill}>
                −{formatEscrowMoney(escrow.goodwill_applied_cents ?? 0, escrow.currency)}
              </Text>
            </View>
            <View style={[styles.feeBreakdownRow, styles.feeBreakdownTotal]}>
              <Text style={styles.feeBreakdownLabelBold}>Fee charged</Text>
              <Text style={styles.feeBreakdownAmountBold}>
                {formatEscrowMoney(escrow.platform_fee_cents ?? 0, escrow.currency)}
              </Text>
            </View>
          </View>
        ) : null}

        {screenContent.showGroupHostCloseGuard ? (
          <View style={styles.infoCard}>
            <Ionicons name="people-outline" size={22} color={colors.primary} />
            <Text style={styles.infoTitle}>Close the group first</Text>
            <Text style={styles.infoSub}>
              Your share is calculated once you close the group. Go to Manage Offers to review your
              projected share and close the group.
            </Text>
            {groupHostShare && groupHostShare.displayCents > 0 ? (
              <View style={[styles.feeBreakdownRow, { marginTop: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeBreakdownLabel}>Your projected host share</Text>
                  <Text style={styles.feeBreakdownAmountBold}>
                    {formatEscrowMoney(groupHostShare.displayCents, escrow.currency)}
                  </Text>
                  <Text style={[styles.infoSub, { marginTop: spacing.xs, marginBottom: 0 }]}>
                    Plan total minus what accepted guests have committed so far.
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              style={[styles.secondaryBtn, { marginTop: spacing.md }]}
              onPress={() => router.push(`/plan/${escrow.plan_id}/offers` as Href)}
            >
              <Text style={styles.secondaryBtnTxt}>Go to Manage Offers</Text>
            </Pressable>
          </View>
        ) : null}

        {screenContent.showPatternCard &&
        escrow.status === 'pending_funding' &&
        !confirmingPayment &&
        isGroupSplit &&
        !hostViewingGuestLeg ? (
          <View style={styles.infoCard}>
            {screenContent.patternCardKicker ? (
              <Text style={styles.leadKicker}>{screenContent.patternCardKicker}</Text>
            ) : null}
            <Text style={styles.infoTitle}>{screenContent.patternCardTitle}</Text>
            <Text style={styles.infoSub}>{screenContent.patternCardBody}</Text>
            <View style={[styles.feeBreakdownRow, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeBreakdownLabel}>
                  {screenContent.patternLegHostLabel ?? (isHost ? 'Your host share' : 'Your agreed share')}
                </Text>
                <Text style={styles.feeBreakdownAmountBold}>
                  {formatEscrowMoney(userPayGrossCents, escrow.currency)}
                </Text>
                {!isHost ? (
                  <Text style={[styles.infoSub, { marginTop: spacing.xs, marginBottom: 0 }]}>
                    Negotiated and agreed with the host.
                  </Text>
                ) : null}
              </View>
              <View style={styles.waitSplitIcon}>
                <Ionicons
                  name={myLegFunded ? 'checkmark-circle' : 'time-outline'}
                  size={18}
                  color={myLegFunded ? colors.success : colors.textMuted}
                />
              </View>
            </View>
            <View style={styles.feeBreakdownRow}>
              <Text style={[styles.feeBreakdownLabel, { flex: 1 }]}>
                {myLegFunded ? 'Paid' : 'Pending your payment'}
              </Text>
            </View>
            {escrow.funding_deadline ? (
              <Text style={[styles.waitSplitSub, { marginTop: spacing.sm }]}>
                Fund by {formatIsoDateTime(escrow.funding_deadline)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {hostViewingGuestLeg && !confirmingPayment ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.leadKicker}>Group plan · guest escrow</Text>
              <Text style={styles.infoTitle}>
                {guestName}&apos;s secure hold
              </Text>
              <Text style={styles.infoSub}>
                Track this guest&apos;s funding status here. Your host payment is on a separate escrow leg.
              </Text>
              <View style={[styles.feeBreakdownRow, { marginTop: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeBreakdownLabel}>Guest agreed share</Text>
                  <Text style={styles.feeBreakdownAmountBold}>
                    {formatEscrowMoney(escrow.amount_cents, escrow.currency)}
                  </Text>
                </View>
                <View style={styles.waitSplitIcon}>
                  <Ionicons
                    name={escrow.guest_funded_at ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                    color={escrow.guest_funded_at ? colors.success : colors.textMuted}
                  />
                </View>
              </View>
              <Text style={[styles.feeBreakdownLabel, { marginTop: spacing.sm }]}>
                {escrow.guest_funded_at ? 'Funded' : 'Awaiting guest payment'}
              </Text>
            </View>

            <EscrowGroupHostShareBreakdownCard
              planTotalCents={planTotalCents}
              guestsCommittedCents={guestsCommittedCents}
              hostShareCents={hostShareDisplayCents}
              hostPayGrossCents={hostSharePayGrossCents}
              currency={escrow.currency}
              groupClosed={groupClosed}
              hostShareFunded={hostShareFunded}
              hostEscrowId={plan?.host_escrow_id ?? null}
            />
          </>
        ) : null}

        {screenContent.showPatternCard &&
        screenContent.showPatternLegCards &&
        escrow.status === 'pending_funding' &&
        !confirmingPayment &&
        !isGroupSplit ? (
          <EscrowSplitFundingCard
            hostShareCents={patternBLegGrossCents(escrow, 'host')}
            guestShareCents={patternBLegGrossCents(escrow, 'guest')}
            hostFunded={!!escrow.host_funded_at}
            guestFunded={!!escrow.guest_funded_at}
            currency={escrow.currency}
            fundingDeadlineIso={escrow.funding_deadline}
            currentUserIsHost={user.id === escrow.host_id}
            kicker={screenContent.patternCardKicker ?? undefined}
            title={screenContent.patternCardTitle ?? undefined}
            sub={screenContent.patternCardBody ?? undefined}
            hostLegLabel={screenContent.patternLegHostLabel ?? undefined}
            guestLegLabel={screenContent.patternLegGuestLabel ?? undefined}
          />
        ) : null}

        {confirmingPayment ? (
          <View style={styles.waitSplitCard}>
            <View style={styles.waitSplitIcon}>
              <Ionicons name="sync-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.waitSplitText}>
              <Text style={styles.waitSplitTitle}>Verifying your payment</Text>
              <Text style={styles.waitSplitSub}>
                This usually takes a few seconds. The fund button will disappear once escrow is confirmed.
              </Text>
            </View>
          </View>
        ) : null}

        {fundingUi.showSinglePayerCard && escrow.status === 'pending_funding' && !confirmingPayment ? (
          <EscrowSinglePayerFundingCard
            pattern={escrow.escrow_pattern === 'C' ? 'C' : 'A'}
            amountCents={escrow.amount_cents}
            currency={escrow.currency}
            fundingDeadlineIso={escrow.funding_deadline}
            payerLabel={patternA ? `${hostName} (host)` : `${guestName} (guest)`}
            isCurrentUserPayer={fundingUi.canFund}
            payerFunded={false}
            isMoodPlan={!!plan?.is_mood_plan}
            kicker={screenContent.patternCardKicker ?? undefined}
            title={screenContent.patternCardTitle ?? undefined}
            sub={screenContent.patternCardBody ?? undefined}
          />
        ) : null}

        {escrowFullyFunded && (patternA || patternC) ? (
          <View style={styles.successInlineCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={styles.waitSplitText}>
              <Text style={styles.waitSplitTitle}>Payment complete</Text>
              <Text style={styles.waitSplitSub}>
                Escrow is funded and held until you confirm the meetup happened as agreed.
              </Text>
            </View>
          </View>
        ) : null}

        {patternB && escrow.status === 'pending_funding' && escrowFullyFunded && !isGroupSplit ? (
          <View style={styles.successInlineCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={styles.waitSplitText}>
              <Text style={styles.waitSplitTitle}>Both shares funded</Text>
              <Text style={styles.waitSplitSub}>
                Escrow is fully funded and held until you confirm the meetup happened as agreed.
              </Text>
            </View>
          </View>
        ) : null}

        {showWaitingCard ? (
          <View style={styles.waitSplitCard}>
            <View style={styles.waitSplitIcon}>
              <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.waitSplitText}>
              <Text style={styles.waitSplitTitle}>
                {screenContent.waitingTitle ??
                  fundingUi.waitingTitle ??
                  'Waiting for the other person'}
              </Text>
              <Text style={styles.waitSplitSub}>
                {screenContent.waitingCopy ??
                  fundingUi.waitingSubtitle ??
                  "You'll both get confirmation when escrow is fully funded."}
              </Text>
            </View>
          </View>
        ) : null}

        <EscrowTimeline items={timelineItems} />

        {showWaitingFunded ? (
          <View style={styles.infoCard}>
            <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
            <Text style={styles.infoTitle}>Waiting for plan completion</Text>
            <Text style={styles.infoSub}>
              When you&apos;ve met in person and everything matches what you agreed, confirm below. Then funds can be
              released.
            </Text>
            <Pressable
              style={[styles.secondaryBtn, { marginTop: spacing.md }, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => setCompleteConfirmOpen(true)}
            >
              <Text style={styles.secondaryBtnTxt}>Confirm meetup complete</Text>
            </Pressable>
            <Pressable style={[styles.ghostBtn, { marginTop: spacing.sm }]} onPress={() => setDisputeOpen(true)}>
              <Text style={styles.ghostBtnTxt}>Open dispute</Text>
            </Pressable>
          </View>
        ) : null}

        {showReleaseBlock ? (
          <>
            <EscrowFundCTA
              title="Release funds"
              subtitle="Meetup marked complete. Release when you're satisfied."
              onPress={() => setReleaseConfirmOpen(true)}
              disabled={busy}
              loading={busy}
            />
            <Pressable style={styles.ghostBtn} onPress={() => setDisputeOpen(true)} disabled={busy}>
              <Text style={styles.ghostBtnTxt}>Report issue</Text>
            </Pressable>
          </>
        ) : null}

        {escrow.status === 'funded' && !disputed && !showWaitingFunded && !showReleaseBlock ? (
          <Pressable style={styles.ghostBtn} onPress={() => setDisputeOpen(true)}>
            <Text style={styles.ghostBtnTxt}>Open dispute</Text>
          </Pressable>
        ) : null}

        {escrow.status === 'released' &&
        (escrow.metadata as Record<string, unknown> | null)?.auto_released === true ? (
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
            <Text style={styles.infoTitle}>Automatically released</Text>
            <Text style={styles.infoSub}>
              Funds were automatically released 24 hours after plan completion.
            </Text>
          </View>
        ) : null}

        {escrow.status === 'released' ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <Text style={styles.successTitle}>Funds released</Text>
            <Text style={styles.successSub}>
              {getReleaseRecipientLabel(escrow.escrow_pattern, hostName, guestName)}. Thanks for using LinkUp
              escrow.
            </Text>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/support' as Href)}>
              <Text style={styles.secondaryBtnTxt}>Contact support</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {showFund ? (
        <View style={styles.footerBar}>
          <EscrowFundCTA
            title={busy ? 'Please wait…' : fundCtaTitle}
            subtitle={fundCtaSubtitle}
            onPress={handleFundEscrow}
            disabled={busy || confirmingPayment}
            loading={busy}
          />
          <Modal
            visible={showMethodSelector}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setShowMethodSelector(false)}
          >
            <Pressable
              style={styles.selectorOverlay}
              onPress={() => setShowMethodSelector(false)}
            >
              <Pressable
                style={[styles.selectorSheet, { paddingBottom: spacing.xl + insets.bottom }]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.selectorHandle} />
                <Text style={styles.selectorTitle}>How would you like to pay?</Text>
                <PaymentMethodSelector
                  selected={selectedPaymentMethod}
                  onSelect={setSelectedPaymentMethod}
                />
                <Pressable
                  style={[
                    styles.selectorConfirmButton,
                    !selectedPaymentMethod && styles.selectorConfirmButtonDisabled,
                  ]}
                  onPress={() => void handleMethodConfirmed()}
                  disabled={!selectedPaymentMethod}
                >
                  <LinearGradient
                    colors={
                      selectedPaymentMethod
                        ? [...APP_CTA_GRADIENT]
                        : [colors.border, colors.border]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.selectorConfirmGradient}
                  >
                    <Text style={styles.selectorConfirmLabel}>Continue</Text>
                  </LinearGradient>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
          {__DEV__ ? (
            <Pressable style={styles.ghostBtn} onPress={() => void onDemoFunded()} disabled={busy}>
              <Text style={styles.ghostBtnTxt}>Demo: mark funded (no payment)</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {(paymentPendingConfirmation || showPaymentConfirmedFooter) && !escrowFunded ? (
        <View style={styles.footerBar}>
          {showPaymentConfirmedFooter ? (
            <View style={styles.confirmingTimeout}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <Text style={styles.confirmingTitle}>{paymentConfirmedCopy.title}</Text>
              <Text style={styles.confirmingSub}>{paymentConfirmedCopy.message}</Text>
              <View style={styles.confirmingActionsRow}>
                {returnToPlanCta(styles.confirmingActionBtn)}
              </View>
            </View>
          ) : confirmationStatus === 'timeout' ? (
            <View style={styles.confirmingTimeout}>
              <Ionicons name="time-outline" size={40} color={colors.warning} />
              <Text style={styles.confirmingTitle}>Taking longer than expected</Text>
              <Text style={styles.confirmingSub}>
                Your payment was received by Flutterwave. We&apos;re still waiting for the
                confirmation to reach us. This can occasionally take a minute.
              </Text>
              <View style={styles.confirmingActionsRow}>
                <Pressable
                  onPress={() => void onCheckPaymentAgain()}
                  disabled={checkAgainBusy}
                  style={({ pressed }) => [
                    styles.confirmingActionBtn,
                    styles.checkAgainOuter,
                    pressed && !checkAgainBusy && { opacity: 0.94, transform: [{ scale: 0.985 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Check payment again"
                >
                  <LinearGradient
                    colors={
                      checkAgainBusy
                        ? [colors.border, colors.border]
                        : [...APP_CTA_GRADIENT]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.checkAgainGrad}
                  >
                    {checkAgainBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.checkAgainTxt}>Check again</Text>
                    )}
                  </LinearGradient>
                </Pressable>
                {returnToPlanCta(styles.confirmingActionBtn)}
              </View>
            </View>
          ) : (
            <View style={styles.confirmingBar}>
              <ActivityIndicator color={colors.primary} />
              <View style={styles.confirmingText}>
                <Text style={styles.confirmingTitle}>Confirming payment with escrow</Text>
                <Text style={styles.confirmingSub}>
                  Your Flutterwave payment is being applied.
                  {secondsElapsed > 8
                    ? ' This is taking a moment. Please wait.'
                    : ' This usually takes a few seconds.'}
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  fallbackPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fallbackTxt: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  fallbackBtn: { paddingVertical: spacing.md },
  fallbackBtnTxt: {
    color: colors.primary,
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  scrollWithFooter: { paddingBottom: 160 },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  selectorHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  selectorTitle: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  selectorConfirmButton: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  selectorConfirmButtonDisabled: {
    opacity: 0.4,
  },
  selectorConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorConfirmLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  footerBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  confirmingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmingText: { flex: 1, gap: 4 },
  confirmingTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  confirmingSub: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
  },
  confirmingTimeout: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  confirmingActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.sm,
  },
  confirmingActionBtn: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
  },
  checkAgainOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.26,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  checkAgainGrad: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkAgainTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  leadAccent: { width: 5, marginTop: 8, borderRadius: 3, height: 52 },
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
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, fontWeight: '600',
    fontFamily: fonts.medium,},
  meetupUrgent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  meetupUrgentTxt: { flex: 1, fontSize: 14, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.text, lineHeight: 20 },
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
  messageCtaRing: { padding: 2, borderRadius: radius.button },
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
  badgeRow: { marginBottom: spacing.sm },
  warnBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  warnTxt: { flex: 1, color: '#991B1B', fontWeight: '600',
    fontFamily: fonts.medium, lineHeight: 20 },
  ghostBtn: { paddingVertical: 14, alignItems: 'center', marginBottom: spacing.lg },
  ghostBtnTxt: { color: colors.primary, fontSize: 16, fontWeight: '700', fontFamily: fonts.medium, },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnTxt: { color: colors.primary, fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold,},
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    marginBottom: spacing.xl,
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
  infoTitle: { fontSize: 17, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, marginTop: spacing.sm, letterSpacing: -0.2 },
  infoSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm, fontWeight: '600', fontFamily: fonts.medium, },
  waitSplitCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  waitSplitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitSplitText: { flex: 1, minWidth: 0 },
  waitSplitTitle: { fontSize: 16, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, marginBottom: 4, letterSpacing: -0.2 },
  waitSplitSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  successInlineCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#047857',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  successTitle: { fontSize: 18, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, marginTop: spacing.sm, letterSpacing: -0.2 },
  successSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  feeBreakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginBottom: spacing.md,
  },
  feeBreakdownTitle: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feeBreakdownTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  feeBreakdownLabel: { fontSize: 14, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.textMuted },
  feeBreakdownLabelGoodwill: { fontSize: 14, fontWeight: '700', color: '#047857', fontFamily: fonts.medium, },
  feeBreakdownLabelBold: { fontSize: 14, fontWeight: '900', color: colors.text, fontFamily: fonts.bold, },
  feeBreakdownAmount: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: fonts.medium, },
  feeBreakdownStrike: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  feeBreakdownGoodwill: { fontSize: 14, fontWeight: '900',
    fontFamily: fonts.bold, color: '#047857' },
  feeBreakdownAmountBold: { fontSize: 16, fontWeight: '900', color: colors.text, fontFamily: fonts.bold, },
});
