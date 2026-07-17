/**
 * 1:1 and mood plan escrow status + shortcut to the secure payment screen.
 */
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { formatEscrowMoney, patternLabel } from '@/lib/escrow/escrowPaymentPreview';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import {
  isEscrowFullyFundedForMeet,
  isSplitEscrowPartiallyFunded,
  isSplitEscrowPattern,
} from '@/lib/escrow/splitEscrowFunding';
import { resumeEscrowSettlementIfNeeded } from '@/lib/escrow/resumeEscrowSettlement';
import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import { supabase } from '@/lib/supabase';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  plan: DbPlan;
  offer: DbPlanOffer;
  currentUserId: string;
  userIsPayer: boolean;
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
});

export function PlanEscrowPaymentCard({ plan, offer, currentUserId, userIsPayer }: Props) {
  const [escrow, setEscrow] = useState<DbEscrowTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const settlementKeyRef = useRef<string | null>(null);
  const syncingRef = useRef(false);

  const load = useCallback(async (): Promise<DbEscrowTransaction | null> => {
    if (plan.is_group_plan || !plan.is_paid) {
      setLoading(false);
      return;
    }

    const { data: byGuest } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('guest_id', offer.bidder_id)
      .maybeSingle();

    let row = byGuest as DbEscrowTransaction | null;
    if (!row) {
      const { data: byPlan } = await supabase
        .from('escrow_transactions')
        .select('*')
        .eq('plan_id', plan.id)
        .maybeSingle();
      row = byPlan ? (byPlan as DbEscrowTransaction) : null;
    }

    setEscrow(row);
    setLoading(false);
    return row;
  }, [plan.id, plan.is_group_plan, plan.is_paid, offer.bidder_id]);

  const tryResumeSettlement = useCallback(async (row: DbEscrowTransaction | null) => {
    if (!row || row.status !== 'pending_funding' || syncingRef.current) {
      if (!row || row.status !== 'pending_funding') {
        setSyncingPayment(false);
      }
      return;
    }

    const metaKey =
      row.metadata && typeof row.metadata === 'object' ? JSON.stringify(row.metadata) : '';
    const key = `${row.id}:${metaKey}`;
    if (settlementKeyRef.current === key) {
      return;
    }
    settlementKeyRef.current = key;
    syncingRef.current = true;
    setSyncingPayment(true);

    const { ran } = await resumeEscrowSettlementIfNeeded(supabase, row, currentUserId);
    if (ran) {
      await load();
    }

    syncingRef.current = false;
    setSyncingPayment(false);
  }, [load, currentUserId]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const tryResumeRef = useRef(tryResumeSettlement);
  tryResumeRef.current = tryResumeSettlement;

  useEffect(() => {
    void (async () => {
      const row = await load();
      await tryResumeRef.current(row);
    })();
  }, [load]);

  useEffect(() => {
    if (plan.is_group_plan || !plan.is_paid) return;
    return subscribeEscrowRealtime({
      planId: plan.id,
      escrowId: escrow?.id,
      onRefresh: () => {
        void (async () => {
          const row = await loadRef.current();
          settlementKeyRef.current = null;
          await tryResumeRef.current(row);
        })();
      },
    });
  }, [plan.id, plan.is_group_plan, plan.is_paid, escrow?.id, currentUserId]);

  if (plan.is_group_plan || !plan.is_paid) return null;

  const fundingUi = escrow ? getEscrowFundingUiState(escrow, currentUserId) : null;
  const pattern = plan.escrow_pattern ?? 'A';
  const isSplit = isSplitEscrowPattern(pattern);
  const fullyFunded = escrow ? isEscrowFullyFundedForMeet(escrow) : false;
  const partiallyFunded = escrow ? isSplitEscrowPartiallyFunded(escrow) : false;
  const showCta =
    escrow?.id && !fullyFunded && (fundingUi?.canFund || escrow.status === 'pending_funding');

  let ctaLabel = 'Open secure payment';
  if (fundingUi?.canFund) {
    ctaLabel = fundingUi.fundCtaTitle;
  } else if (!userIsPayer && escrow?.status === 'pending_funding') {
    ctaLabel = 'View payment status';
  }

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(94, 82, 255,0.18)', 'rgba(255, 74, 114,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />

      <View style={styles.headerRow}>
        <LinearGradient
          colors={['rgba(94, 82, 255,0.14)', 'rgba(255, 74, 114,0.08)']}
          style={styles.iconWrap}
        >
          <Ionicons
            name={plan.is_mood_plan ? 'flash-outline' : 'wallet-outline'}
            size={22}
            color={plan.is_mood_plan ? colors.secondary : colors.primary}
          />
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>
            {plan.is_mood_plan ? 'Mood escrow · 1h window' : 'Secure payment'}
          </Text>
          <Text style={styles.title}>
            {escrow ? patternLabel(pattern) : 'Escrow setup'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : escrow ? (
        <View style={styles.statusRow}>
          <EscrowStatusBadge status={escrow.status} />
          {syncingPayment ? (
            <View style={styles.syncRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.syncTxt}>Confirming payment with escrow…</Text>
            </View>
          ) : null}
          {!syncingPayment && fundingUi?.canFund && fundingUi.payAmountCents > 0 ? (
            <Text style={styles.amountHint}>
              Your payment: {formatEscrowMoney(fundingUi.payAmountCents, escrow.currency)}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.pendingSetup}>
          {userIsPayer
            ? 'Tap the button below to open the payment screen and fund escrow.'
            : 'Waiting for the other party to set up secure payment.'}
        </Text>
      )}

      {fullyFunded ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.successTxt}>
            {isSplit ? 'Both shares funded. Your plan is now active.' : 'Escrow funded. Your plan is now active.'}
          </Text>
        </View>
      ) : partiallyFunded ? (
        <View style={styles.syncBanner}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.syncBannerTxt}>
            {fundingUi?.waitingForCounterparty
              ? fundingUi.waitingSubtitle ??
                "You've paid your share. Waiting for the other person to fund theirs."
              : 'One share funded. Both parties must pay before the meetup is confirmed.'}
          </Text>
        </View>
      ) : null}

      {showCta && escrow?.id ? (
        <Pressable
          onPress={() => router.push(`/escrow/${escrow.id}` as Href)}
          style={({ pressed }) => [styles.ctaRow, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[...APP_CHIP_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Text style={styles.ctaTxt}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    overflow: 'hidden',
    ...cardShadow,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  loader: { marginVertical: spacing.sm },
  statusRow: { gap: spacing.sm, marginBottom: spacing.sm },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncTxt: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  amountHint: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  pendingSetup: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
  },
  syncBannerTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.primary,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  successTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: '#047857',
    lineHeight: 18,
  },
  ctaRow: { marginTop: spacing.sm, borderRadius: radius.button, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  ctaTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
