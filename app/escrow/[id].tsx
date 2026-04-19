/**
 * E1 — Escrow detail: Paystack funding, trust copy, timeline, release & disputes.
 */
import { Button } from '@/components/Button';
import { EscrowConfirmModal } from '@/components/escrow/EscrowConfirmModal';
import { EscrowCounterpartyHeader, type EscrowParty } from '@/components/escrow/EscrowCounterpartyHeader';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { EscrowStepIndicator } from '@/components/escrow/EscrowStepIndicator';
import { EscrowSummaryCard } from '@/components/escrow/EscrowSummaryCard';
import { EscrowTimeline } from '@/components/escrow/EscrowTimeline';
import { OpenDisputeModal } from '@/components/escrow/OpenDisputeModal';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { buildEscrowTimeline } from '@/lib/escrow/buildEscrowTimeline';
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
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function paymentStatusLabel(status: DbEscrowTransaction['status']): string {
  switch (status) {
    case 'pending_funding':
      return 'Waiting for payment';
    case 'funded':
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

    const cpId = user?.id === esc.payer_id ? esc.payee_id : esc.payer_id;
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
    const other = escrow.payer_id === user.id ? escrow.payee_id : escrow.payer_id;
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
      const opened = await openEscrowPaystackCheckout({
        email: user.email ?? '',
        amountKobo: escrow.amount_cents,
        escrowId: escrow.id,
        planId: escrow.plan_id,
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
    if (!plan) return;
    await runLocked(async () => {
      const { error } = await confirmMeetupComplete(supabase, plan.id);
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
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const isPayer = escrow.payer_id === user.id;
  const isPayee = escrow.payee_id === user.id;
  const stepIdx = stepActiveIndex(escrow, plan);
  const whenLabel = formatIsoDateTime(plan?.agreed_scheduled_at, plan?.scheduled_at ?? undefined);
  const locationLabel = plan?.agreed_location ?? plan?.location_label ?? '—';
  const amountLabel = (escrow.amount_cents / 100).toFixed(0);
  const trustNote =
    'Your payment is secure and stays in escrow until you confirm the meetup completed successfully.';

  const disputed = escrow.status === 'disputed';
  const showFund = escrow.status === 'pending_funding' && isPayer;
  const showWaitingFunded =
    escrow.status === 'funded' && plan?.status === 'active' && !disputed;
  const showReleaseBlock =
    escrow.status === 'funded' && plan?.status === 'completed' && !disputed;
  const showDisputedBanner = disputed;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title="Verification required"
        message="Only verified members can fund escrow or complete secure payments on LinkUp."
      />
      <EscrowConfirmModal
        visible={fundConfirmOpen}
        title="Fund escrow?"
        message="You will open a secure Paystack checkout. Funds are held until the meetup is confirmed or a dispute is resolved."
        confirmLabel="Continue"
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

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Secure payment</Text>
        <Pressable onPress={() => router.push('/support' as Href)} hitSlop={12}>
          <Text style={styles.helpLink}>Help</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {counterparty ? (
          <EscrowCounterpartyHeader
            title={plan?.title ?? 'Paid plan'}
            counterparty={counterparty}
            youLabel={isPayer ? 'You are paying' : isPayee ? 'You are hosting' : ''}
          />
        ) : null}

        <Button
          title="Message"
          variant="secondary"
          onPress={() => void openChatWithCounterparty()}
          style={styles.chatBtn}
        />

        <View style={styles.badgeRow}>
          <EscrowStatusBadge status={escrow.status} />
        </View>

        <EscrowStepIndicator activeIndex={stepIdx} />

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
        />

        <EscrowTimeline items={timelineItems} />

        {showFund ? (
          <View style={styles.ctaBlock}>
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => setFundConfirmOpen(true)}
            >
              <Text style={styles.primaryBtnTxt}>{busy ? 'Please wait…' : 'Fund escrow'}</Text>
            </Pressable>
            {__DEV__ ? (
              <Pressable style={styles.ghostBtn} onPress={() => void onDemoFunded()} disabled={busy}>
                <Text style={styles.ghostBtnTxt}>Demo: mark funded (no Paystack)</Text>
              </Pressable>
            ) : null}
          </View>
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
              style={[styles.secondaryBtn, { marginTop: spacing.md }, busy && styles.btnDisabled]}
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
          <View style={styles.ctaBlock}>
            <Text style={styles.releaseHint}>Meetup marked complete. Release when you&apos;re satisfied.</Text>
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => setReleaseConfirmOpen(true)}
            >
              <Text style={styles.primaryBtnTxt}>Release funds</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => setDisputeOpen(true)} disabled={busy}>
              <Text style={styles.ghostBtnTxt}>Report issue</Text>
            </Pressable>
          </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  helpLink: { fontSize: 16, fontWeight: '700', color: colors.primary },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  chatBtn: { marginBottom: spacing.md },
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
  ctaBlock: { marginBottom: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 200,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
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
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  infoTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  infoSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm },
  releaseHint: { fontSize: 15, color: colors.text, fontWeight: '600', marginBottom: spacing.md, lineHeight: 22 },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  successTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  successSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
