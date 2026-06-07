/**
 * E1 — Escrow detail: Paystack funding, trust copy, timeline, release & disputes.
 */
import { EscrowConfirmModal } from '@/components/escrow/EscrowConfirmModal';
import { EscrowCounterpartyHeader, type EscrowParty } from '@/components/escrow/EscrowCounterpartyHeader';
import { EscrowFundCTA } from '@/components/escrow/EscrowFundCTA';
import { EscrowScreenHeader } from '@/components/escrow/EscrowScreenHeader';
import { EscrowSplitFundingCard } from '@/components/escrow/EscrowSplitFundingCard';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { EscrowStepIndicator } from '@/components/escrow/EscrowStepIndicator';
import { EscrowSummaryCard } from '@/components/escrow/EscrowSummaryCard';
import { EscrowTimeline } from '@/components/escrow/EscrowTimeline';
import { FundingDeadlineUrgencyBanner } from '@/components/escrow/FundingDeadlineUrgencyBanner';
import { OpenDisputeModal } from '@/components/escrow/OpenDisputeModal';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { Screen } from '@/components/Screen';
import { DiscoveryGradientBg } from '@/components/ui/DiscoveryGradientBg';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { buildEscrowTimeline } from '@/lib/escrow/buildEscrowTimeline';
import { formatEscrowMoney, isMeetupWithinHours, meetupHoursUntilLabel } from '@/lib/escrow/escrowPaymentPreview';
import {
  confirmMeetupComplete,
  markEscrowFunded,
  openEscrowDisputeWithTicket,
  recordEscrowPaymentInitiated,
  releaseEscrowFunds,
} from '@/lib/escrow/escrowActions';
import { openEscrowPaystackCheckout } from '@/lib/escrow/openEscrowCheckout';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbEscrowDispute, DbEscrowTransaction, DbPlan } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function paymentStatusLabel(status: DbEscrowTransaction['status']): string {
  switch (status) {
    case 'pending_funding':
      return 'Waiting for payment';
    case 'funded':
      return 'Held securely in escrow';
    case 'active':
      return 'Held securely in escrow';
    case 'released':
      return 'Released to host';
    case 'disputed':
      return 'On hold — dispute';
    case 'refunded':
      return 'Refunded';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function stepActiveIndex(escrow: DbEscrowTransaction, plan: DbPlan | null): number {
  if (escrow.status === 'released') return 3;
  if (plan?.status === 'completed' && escrow.status === 'funded') return 2;
  if (escrow.status !== 'pending_funding') return 1;
  return 0;
}

export default function EscrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, dbUser } = useAuth();
  const [escrow, setEscrow] = useState<DbEscrowTransaction | null>(null);
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [dispute, setDispute] = useState<DbEscrowDispute | null>(null);
  const [counterparty, setCounterparty] = useState<EscrowParty | null>(null);
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [fundConfirmOpen, setFundConfirmOpen] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const actionLock = useRef(false);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured || !user?.id) return;
    const { data: eRow } = await supabase.from('escrow_transactions').select('*').eq('id', id).single();
    if (!eRow) {
      setEscrow(null);
      return;
    }
    const esc = eRow as DbEscrowTransaction;
    setEscrow(esc);

    const { data: pRow } = await supabase.from('plans').select('*').eq('id', esc.plan_id).single();
    setPlan(pRow ? (pRow as DbPlan) : null);

    const { data: dRow } = await supabase
      .from('escrow_disputes')
      .select('*')
      .eq('escrow_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setDispute(dRow ? (dRow as DbEscrowDispute) : null);

    const cpId =
      esc.host_id && esc.guest_id
        ? user.id === esc.host_id
          ? esc.guest_id
          : esc.host_id
        : user.id === esc.payer_id
          ? esc.payee_id
          : esc.payer_id;
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, verified_badge')
      .eq('user_id', cpId)
      .maybeSingle();
    if (prof) {
      setCounterparty({
        name: prof.display_name ?? 'Member',
        avatarUrl: prof.avatar_url,
        verified: !!prof.verified_badge,
      });
    } else {
      setCounterparty({ name: 'Member', avatarUrl: null, verified: false });
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const timelineItems = useMemo(() => {
    if (!escrow) return [];
    return buildEscrowTimeline(escrow, plan, dispute);
  }, [escrow, plan, dispute]);

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
      await openDirectChat(supabase, user.id, other);
    } catch (e) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Could not open chat');
    }
  }, [user, escrow]);

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

  async function onConfirmFund() {
    setFundConfirmOpen(false);
    if (!escrow || !user?.email || !requireVerified()) return;
    await runLocked(async () => {
      let amountKobo = escrow.amount_cents;
      let escrowLeg: 'host' | 'guest' | undefined;
      if (escrow.escrow_pattern === 'B') {
        if (user.id === escrow.host_id && !escrow.host_funded_at) {
          escrowLeg = 'host';
          amountKobo = escrow.host_share_cents ?? 0;
        } else if (user.id === escrow.guest_id && !escrow.guest_funded_at) {
          escrowLeg = 'guest';
          amountKobo = escrow.guest_share_cents ?? 0;
        } else {
          Alert.alert('Payment', 'No pending share for you on this escrow.');
          return;
        }
        if (amountKobo <= 0) {
          Alert.alert('Payment', 'Invalid split amount.');
          return;
        }
      }

      const opened = await openEscrowPaystackCheckout({
        email: user.email ?? '',
        amountKobo,
        escrowId: escrow.id,
        planId: escrow.plan_id,
        escrowLeg,
      });
      if (!opened.ok) {
        Alert.alert('Checkout', opened.error ?? 'Could not open payment.');
        return;
      }
      const { error } = await recordEscrowPaymentInitiated(supabase, escrow.id, opened.reference);
      if (error) Alert.alert('Escrow', error);
      else void load();
    });
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
    if (!plan || !user) return;
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
        router.push('/support' as Href);
      }
    });
  }

  if (!escrow || !user) {
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

  const isPayer = escrow.payer_id === user.id;
  const isPayee = escrow.payee_id === user.id;
  const patternB = escrow.escrow_pattern === 'B';
  const needHostLeg =
    patternB &&
    escrow.status === 'pending_funding' &&
    !escrow.host_funded_at &&
    escrow.host_id === user.id;
  const needGuestLeg =
    patternB &&
    escrow.status === 'pending_funding' &&
    !escrow.guest_funded_at &&
    escrow.guest_id === user.id;
  const showFundSingle = escrow.status === 'pending_funding' && !patternB && isPayer;
  const showFund = showFundSingle || needHostLeg || needGuestLeg;
  const iPaidMySplitLeg =
    patternB &&
    ((user.id === escrow.host_id && !!escrow.host_funded_at) ||
      (user.id === escrow.guest_id && !!escrow.guest_funded_at));
  const bothSplitLegs = !!(escrow.host_funded_at && escrow.guest_funded_at);
  const showSplitWaitingOther =
    patternB && escrow.status === 'pending_funding' && iPaidMySplitLeg && !bothSplitLegs;
  const stepIdx = stepActiveIndex(escrow, plan);
  const whenLabel = formatIsoDateTime(plan?.agreed_scheduled_at, plan?.scheduled_at ?? undefined);
  const locationLabel = plan?.agreed_location ?? plan?.location_label ?? '—';
  const amountLabel = (escrow.amount_cents / 100).toFixed(0);
  const userPayCents =
    needHostLeg
      ? (escrow.host_share_cents ?? 0)
      : needGuestLeg
        ? (escrow.guest_share_cents ?? 0)
        : showFundSingle
          ? escrow.amount_cents
          : 0;
  const yourShareLabel =
    userPayCents > 0 ? formatEscrowMoney(userPayCents, escrow.currency) : null;
  const fundConfirmAmountLabel = yourShareLabel ?? formatEscrowMoney(escrow.amount_cents, escrow.currency);
  const meetupIso = plan?.agreed_scheduled_at ?? plan?.scheduled_at ?? null;
  const meetupSoonPending = escrow.status === 'pending_funding' && isMeetupWithinHours(meetupIso, 48);
  const meetupWhenLabel = meetupHoursUntilLabel(meetupIso);
  const trustNote =
    'Your payment is secure and stays in escrow until you confirm the meetup completed successfully.';
  const fundCtaSubtitle = patternB
    ? `Your share: ${fundConfirmAmountLabel} · guest and host pay separately on this screen`
    : `Total held: ${formatEscrowMoney(escrow.amount_cents, escrow.currency)} via Paystack`;

  const disputed = escrow.status === 'disputed';
  const showWaitingFunded =
    escrow.status === 'funded' && plan?.status === 'active' && !disputed;
  const showReleaseBlock =
    escrow.status === 'funded' && plan?.status === 'completed' && !disputed;
  const showDisputedBanner = disputed;

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
      <EscrowConfirmModal
        visible={fundConfirmOpen}
        title="Open secure checkout?"
        message={`You'll pay ${fundConfirmAmountLabel} in Paystack. Funds stay in escrow until the meetup is confirmed or a dispute is resolved.`}
        confirmLabel="Continue to Paystack"
        cancelLabel="Not now"
        onCancel={() => setFundConfirmOpen(false)}
        onConfirm={() => void onConfirmFund()}
        confirmVariant="primary"
      />
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
        message="This pays out the held amount to the host. This cannot be undone from the app."
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

      <EscrowScreenHeader topInset={insets.top} />

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
            <Text style={styles.leadKicker}>Escrow</Text>
            <Text style={styles.leadTitle}>
              {showFund ? 'Complete payment' : 'Secure hold'}
            </Text>
            <Text style={styles.leadSub}>
              {showFund
                ? 'This is the payment screen — Paystack checkout opens when you tap below.'
                : 'Track funding, meetup, and release in one place.'}
            </Text>
          </View>
        </View>

        {meetupSoonPending && meetupWhenLabel ? (
          <View style={styles.meetupUrgent}>
            <Ionicons name="alarm-outline" size={20} color={colors.warning} />
            <Text style={styles.meetupUrgentTxt}>
              Meetup {meetupWhenLabel} — {showFund ? 'fund escrow now' : 'complete funding soon'} so you&apos;re covered.
            </Text>
          </View>
        ) : null}

        {counterparty ? (
          <EscrowCounterpartyHeader
            title={plan?.title ?? 'Paid plan'}
            counterparty={counterparty}
            youLabel={
              patternB
                ? needHostLeg || needGuestLeg
                  ? 'Your share is due'
                  : 'Split escrow'
                : isPayer
                  ? 'You are paying'
                  : isPayee
                    ? 'You are hosting'
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
          <EscrowStatusBadge status={escrow.status} />
        </View>

        <EscrowStepIndicator activeIndex={stepIdx} />

        {escrow.status === 'pending_funding' && escrow.funding_deadline && !showDisputedBanner ? (
          <FundingDeadlineUrgencyBanner
            deadlineIso={escrow.funding_deadline}
            isMoodPlan={!!plan?.is_mood_plan}
          />
        ) : null}

        {showDisputedBanner ? (
          <View style={styles.warnBanner}>
            <Ionicons name="alert-circle" size={22} color={colors.danger} />
            <Text style={styles.warnTxt}>Dispute in progress — payment actions are paused while we review.</Text>
          </View>
        ) : null}

        <EscrowSummaryCard
          amountLabel={amountLabel}
          currency={escrow.currency}
          paymentStatusLabel={paymentStatusLabel(escrow.status)}
          whenLabel={whenLabel}
          locationLabel={locationLabel}
          trustNote={trustNote}
          yourShareLabel={yourShareLabel}
        />

        {patternB && escrow.status === 'pending_funding' ? (
          <EscrowSplitFundingCard
            hostShareCents={escrow.host_share_cents ?? 0}
            guestShareCents={escrow.guest_share_cents ?? 0}
            hostFunded={!!escrow.host_funded_at}
            guestFunded={!!escrow.guest_funded_at}
            currency={escrow.currency}
            fundingDeadlineIso={escrow.funding_deadline}
            currentUserIsHost={user.id === escrow.host_id}
          />
        ) : null}

        {showSplitWaitingOther ? (
          <View style={styles.waitSplitCard}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
            <Text style={styles.waitSplitTitle}>Waiting for the other person</Text>
            <Text style={styles.waitSplitSub}>Their share is still pending. You&apos;ll both get confirmation when escrow is fully funded.</Text>
          </View>
        ) : null}

        <EscrowTimeline items={timelineItems} />

        {showFund ? (
          <>
            <EscrowFundCTA
              title={busy ? 'Please wait…' : needHostLeg || needGuestLeg ? 'Pay your share' : 'Fund escrow'}
              subtitle={fundCtaSubtitle}
              onPress={() => setFundConfirmOpen(true)}
              disabled={busy}
              loading={busy}
            />
            {__DEV__ ? (
              <Pressable style={styles.ghostBtn} onPress={() => void onDemoFunded()} disabled={busy}>
                <Text style={styles.ghostBtnTxt}>Demo: mark funded (no Paystack)</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

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

        {escrow.status === 'released' ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <Text style={styles.successTitle}>Funds released</Text>
            <Text style={styles.successSub}>Thanks for using LinkUp escrow. Need anything else?</Text>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/support' as Href)}>
              <Text style={styles.secondaryBtnTxt}>Contact support</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
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
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, fontWeight: '600' },
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
  meetupUrgentTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
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
  messageCtaText: { fontSize: 16, fontWeight: '800', color: colors.primary, flexShrink: 1 },
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
  warnTxt: { flex: 1, color: '#991B1B', fontWeight: '600', lineHeight: 20 },
  ghostBtn: { paddingVertical: 14, alignItems: 'center', marginBottom: spacing.lg },
  ghostBtnTxt: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 200,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnTxt: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
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
  infoTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  infoSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm },
  waitSplitCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(108,99,255,0.08)',
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  waitSplitTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  waitSplitSub: { flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  successTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  successSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
