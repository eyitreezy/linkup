/**
 * Host-only projected share + close group — slots into Manage offers list footer.
 */
import { Button } from '@/components/Button';
import { negotiationPanelStyles } from '@/components/plans/negotiation/negotiationPanelStyles';
import { colors, spacing, fonts } from '@/constants/theme';
import { closeGroupAndCreateHostEscrow } from '@/lib/plans/groupSplitDynamicActions';
import {
  formatGroupSplitCents,
  isGroupSplitPlan,
  planTotalCostCents,
  resolveGroupHostShareForPlan,
  remainingGuestSlots,
} from '@/lib/plans/groupSplitDynamic';
import { supabase } from '@/lib/supabase';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

type Props = {
  plan: DbPlan;
  onPlanUpdated?: () => void;
};

export function GroupSplitHostFooter({ plan, onPlanUpdated }: Props) {
  const groupClosed = !!plan.group_closed_at;
  const [guestEscrows, setGuestEscrows] = useState<
    Pick<DbEscrowTransaction, 'guest_id' | 'guest_share_cents' | 'amount_cents' | 'guest_funded_at' | 'status'>[]
  >([]);
  const [acceptedOffers, setAcceptedOffers] = useState<
    Pick<DbPlanOffer, 'current_amount_cents' | 'amount_cents'>[]
  >([]);

  const loadEscrows = useCallback(async () => {
    const [{ data: esc }, { data: offers }] = await Promise.all([
      supabase
        .from('escrow_transactions')
        .select('guest_id, guest_share_cents, amount_cents, guest_funded_at, status')
        .eq('plan_id', plan.id)
        .not('guest_id', 'is', null),
      supabase
        .from('plan_offers')
        .select('current_amount_cents, amount_cents')
        .eq('plan_id', plan.id)
        .eq('status', 'accepted'),
    ]);
    setGuestEscrows((esc ?? []) as typeof guestEscrows);
    setAcceptedOffers((offers ?? []) as typeof acceptedOffers);
  }, [plan.id]);

  useEffect(() => {
    if (!isGroupSplitPlan(plan)) return;
    void loadEscrows();
  }, [loadEscrows, plan, plan.updated_at, plan.accepted_guest_amounts_sum_cents, plan.group_closed_at]);

  const hostShare = useMemo(
    () =>
      resolveGroupHostShareForPlan(plan, guestEscrows, {
        acceptedOffers,
      }),
    [acceptedOffers, guestEscrows, plan]
  );
  const total = useMemo(() => planTotalCostCents(plan), [plan]);
  const openSlots = useMemo(() => remainingGuestSlots(plan), [plan]);
  const acceptedCount = plan.accepted_guest_count ?? 0;

  const handleCloseGroup = useCallback(() => {
    Alert.alert(
      'Close group?',
      `You have ${acceptedCount} guest${acceptedCount === 1 ? '' : 's'} confirmed. Your share will be ${formatGroupSplitCents(hostShare.paymentCents, plan.currency)} (includes platform fee). No more guests can join after you close.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close and pay',
          onPress: async () => {
            const { hostEscrowId, error } = await closeGroupAndCreateHostEscrow(supabase, plan.id);
            if (error || !hostEscrowId) {
              Alert.alert('Something went wrong', error ?? 'Could not close the group. Please try again.');
              return;
            }
            onPlanUpdated?.();
            router.push(`/escrow/${hostEscrowId}` as Href);
          },
        },
      ]
    );
  }, [acceptedCount, hostShare.paymentCents, onPlanUpdated, plan.currency, plan.id]);

  if (!isGroupSplitPlan(plan)) return null;

  if (groupClosed) {
    return (
      <View style={[negotiationPanelStyles.footer, styles.bannerWrap]}>
        <View style={styles.closedBanner}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <Text style={styles.closedText}>
            Group closed. Complete your payment from the agreement screen when ready.
          </Text>
        </View>
      </View>
    );
  }

  if (acceptedCount === 0) return null;

  return (
    <View style={[negotiationPanelStyles.footer, styles.wrap]}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your projected share</Text>
        <Text style={styles.cardAmount}>
          {hostShare.displayCents > 0
            ? formatGroupSplitCents(hostShare.displayCents, plan.currency)
            : 'Calculating…'}
        </Text>
        <Text style={styles.cardExplainer}>
          {`This is what you will pay when you close the group. It equals the plan total (${formatGroupSplitCents(total, plan.currency)}) minus what your ${acceptedCount} ${acceptedCount === 1 ? 'guest has' : 'guests have'} committed to.`}
        </Text>
        {openSlots > 0 ? (
          <Text style={styles.openSlots}>
            {`${openSlots} slot${openSlots === 1 ? '' : 's'} still open. Accepting more guests will reduce your share.`}
          </Text>
        ) : null}
      </View>
      <Button
        title="Close group and pay my share"
        variant="secondary"
        pill
        onPress={handleCloseGroup}
        style={styles.closeBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardAmount: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  cardExplainer: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 21,
  },
  openSlots: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  closeBtn: { alignSelf: 'stretch' },
  bannerWrap: { paddingTop: spacing.sm },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  closedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 20,
  },
});
