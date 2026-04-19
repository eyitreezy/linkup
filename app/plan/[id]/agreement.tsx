/**
 * PL6a — Agreement & confirmation after offer accept (trust + structured summary + CTAs).
 */
import { PlanAgreementCTAButton } from '@/components/plans/agreement/PlanAgreementCTAButton';
import { PlanAgreementStatusBadge } from '@/components/plans/agreement/PlanAgreementStatusBadge';
import { PlanAgreementUserHeader, type AgreementParty } from '@/components/plans/agreement/PlanAgreementUserHeader';
import { PlanConfirmationModal } from '@/components/plans/agreement/PlanConfirmationModal';
import { PlanSummaryCard } from '@/components/plans/agreement/PlanSummaryCard';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatIsoDateTime } from '@/lib/plans/formatPlanMeta';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { cancelAgreedPlan, confirmFreePlan, proceedToSecurePayment } from '@/lib/plans/planAgreementActions';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
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
        return;
      }
      const pl = p as DbPlan;

      let off: DbPlanOffer | null = null;
      if (pl.accepted_offer_id) {
        const { data: o } = await supabase.from('plan_offers').select('*').eq('id', pl.accepted_offer_id).single();
        if (o) off = o as DbPlanOffer;
      }

      const bidderId = off?.bidder_id ?? pl.creator_id;

      const [{ data: hp }, { data: bp }] = await Promise.all([
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
      ]);

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
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!loadDone) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={{ paddingTop: insets.top, paddingHorizontal: spacing.lg }}>
          <Text style={styles.muted}>This plan could not be loaded.</Text>
          <Pressable onPress={() => router.replace(`/plan/${id}` as Href)} style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Back to plan</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!plan.accepted_offer_id || !offer) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={{ paddingTop: insets.top, paddingHorizontal: spacing.lg }}>
          <Text style={styles.muted}>No accepted offer for this plan.</Text>
          <Pressable onPress={() => router.replace(`/plan/${id}` as Href)} style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Back to plan</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (plan.status === 'cancelled') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={{ paddingTop: insets.top, paddingHorizontal: spacing.lg }}>
          <Text style={styles.title}>Plan cancelled</Text>
          <Text style={styles.muted}>This agreement is no longer active.</Text>
          <Pressable onPress={() => router.replace('/(tabs)' as Href)} style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Back to feed</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={{ paddingTop: insets.top, paddingHorizontal: spacing.lg }}>
          <Text style={styles.muted}>You don&apos;t have access to this agreement.</Text>
        </View>
      </SafeAreaView>
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
    setBusy(true);
    const { error } = await confirmFreePlan(supabase, planRow.id);
    setBusy(false);
    if (error) Alert.alert('Could not confirm', error);
    else {
      await load();
      router.replace(`/plan/${planRow.id}` as Href);
    }
  }

  async function onConfirmFree() {
    if (busy) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    await runConfirmFree();
  }

  async function onProceedPayment() {
    if (busy) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setBusy(true);
    const res = await proceedToSecurePayment(supabase, planRow, offerRow);
    setBusy(false);
    if (res.error) {
      Alert.alert('Payment setup failed', res.error);
      return;
    }
    if (res.escrowId) router.replace(`/escrow/${res.escrowId}` as Href);
  }

  async function onCancelConfirmed() {
    setCancelOpen(false);
    if (busy || !user) return;
    setBusy(true);
    const { error } = await cancelAgreedPlan(supabase, planRow, offerRow, user.id);
    setBusy(false);
    if (error) Alert.alert('Could not cancel', error);
    else router.replace('/(tabs)' as Href);
  }

  async function onMessageCounterpart() {
    if (!user) return;
    const otherId = isHost ? offerRow.bidder_id : planRow.creator_id;
    try {
      await openDirectChat(supabase, user.id, otherId);
    } catch (e) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Could not open chat');
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
      onPrimary = () => void onProceedPayment();
      primaryDisabled = busy;
    } else {
      primaryLabel = 'Waiting for secure payment';
      onPrimary = () => {};
      primaryDisabled = true;
    }
  } else if (needsConfirm) {
    if (!paymentRequired) {
      primaryLabel = 'Confirm plan';
      onPrimary = () => void onConfirmFree();
      primaryDisabled = busy;
    } else if (isBidder) {
      primaryLabel = 'Proceed to secure payment';
      onPrimary = () => void onProceedPayment();
      primaryDisabled = busy;
    } else {
      primaryLabel = 'Awaiting guest confirmation';
      onPrimary = () => {};
      primaryDisabled = true;
    }
  }

  const showCancelPlan = needsConfirm || awaitingPay;

  const gateTitle = 'Verification required to continue';
  const gateMessage =
    'Confirming plans and sending secure payments requires a verified identity on LinkUp.';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title={gateTitle}
        message={gateMessage}
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

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Confirm plan</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hostParty && guestParty ? <PlanAgreementUserHeader host={hostParty} guest={guestParty} /> : null}

        <PlanAgreementStatusBadge
          primary="Offer accepted"
          secondary={
            needsConfirm
              ? 'Awaiting confirmation — review details carefully'
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

        <View style={styles.trustCard}>
          <Text style={styles.trustTitle}>Both parties agreed to these terms</Text>
          <Text style={styles.trustLine}>
            Accepted{' '}
            {new Date(offerRow.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
          {formatOfferExpiry(offerRow.expires_at) ? (
            <Text style={styles.trustLineMuted}>Offer window · until {formatOfferExpiry(offerRow.expires_at)}</Text>
          ) : null}
        </View>

        {showMessageCta ? (
          <Pressable
            onPress={() => void onMessageCounterpart()}
            style={({ pressed }) => [styles.messageCta, pressed && styles.messageCtaPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open chat with the other person"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
            <Text style={styles.messageCtaText}>
              Message {isHost ? guestParty?.name ?? 'guest' : hostParty?.name ?? 'host'}
            </Text>
          </Pressable>
        ) : null}

        <PlanAgreementCTAButton
          primaryLabel={primaryLabel}
          onPrimary={onPrimary}
          primaryDisabled={primaryDisabled}
          primaryLoading={busy}
          secondaryLabel={showCancelPlan ? 'Cancel plan' : 'Back to feed'}
          onSecondary={showCancelPlan ? () => setCancelOpen(true) : () => router.replace('/(tabs)' as Href)}
          secondaryDisabled={busy}
        />
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  muted: { fontSize: 15, color: colors.textMuted, padding: spacing.lg, lineHeight: 22 },
  linkBtn: { padding: spacing.md },
  linkTxt: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  trustCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  trustTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  trustLine: { fontSize: 14, color: colors.text, lineHeight: 20 },
  trustLineMuted: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  messageCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.sm,
  },
  messageCtaPressed: { opacity: 0.9 },
  messageCtaText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
