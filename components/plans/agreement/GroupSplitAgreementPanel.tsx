/**
 * Group split agreement layout — additional branch on agreement screen.
 */
import { Avatar } from '@/components/Avatar';
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { isUserEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { closeGroupAndCreateHostEscrow } from '@/lib/plans/groupSplitDynamicActions';
import {
  formatGroupSplitCents,
  hostShareFromGuestCommitments,
  isGroupSplitPlan,
  planTotalCostCents,
  projectedHostShareCents,
} from '@/lib/plans/groupSplitDynamic';
import { supabase } from '@/lib/supabase';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function AgreementPrimaryCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryOuter,
        pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryGrad}
      >
        <Text style={styles.primaryText} numberOfLines={2}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

type ProfileMini = { display_name: string | null; avatar_url: string | null };

type Props = {
  plan: DbPlan;
  offer: DbPlanOffer;
  isHost: boolean;
  currentUserId: string;
  onRefresh: () => void;
  showPaymentCta?: boolean;
};

export function GroupSplitAgreementPanel({
  plan,
  offer,
  isHost,
  currentUserId,
  onRefresh,
  showPaymentCta = true,
}: Props) {
  const [escrows, setEscrows] = useState<DbEscrowTransaction[]>([]);
  const [acceptedOffers, setAcceptedOffers] = useState<DbPlanOffer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});

  const load = useCallback(async () => {
    const [{ data: offers }, { data: esc }] = await Promise.all([
      supabase.from('plan_offers').select('*').eq('plan_id', plan.id).eq('status', 'accepted'),
      supabase.from('escrow_transactions').select('*').eq('plan_id', plan.id),
    ]);
    const acc = (offers ?? []) as DbPlanOffer[];
    setAcceptedOffers(acc);
    setEscrows((esc ?? []) as DbEscrowTransaction[]);
    const ids = acc.map((o) => o.bidder_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const map: Record<string, ProfileMini> = {};
      for (const p of profs ?? []) {
        map[p.user_id as string] = {
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
        };
      }
      setProfiles(map);
    }
  }, [plan.id]);

  useEffect(() => {
    void load();
  }, [load, plan.updated_at, plan.group_closed_at, plan.host_escrow_id]);

  const myEscrow = useMemo(
    () => escrows.find((e) => e.guest_id === currentUserId) ?? null,
    [currentUserId, escrows]
  );
  const hostEscrow = useMemo(
    () => (plan.host_escrow_id ? escrows.find((e) => e.id === plan.host_escrow_id) ?? null : null),
    [escrows, plan.host_escrow_id]
  );
  const projected = useMemo(
    () =>
      escrows.length > 0
        ? hostShareFromGuestCommitments(plan, escrows)
        : projectedHostShareCents(plan),
    [escrows, plan]
  );
  const groupClosed = !!plan.group_closed_at;

  const handleCloseGroup = useCallback(() => {
    const acceptedCount = plan.accepted_guest_count ?? 0;
    Alert.alert(
      'Close group?',
      `You have ${acceptedCount} guest${acceptedCount === 1 ? '' : 's'} confirmed. Your share will be ${formatGroupSplitCents(projected, plan.currency)}. No more guests can join after you close.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close and pay',
          onPress: async () => {
            const { hostEscrowId, error } = await closeGroupAndCreateHostEscrow(supabase, plan.id);
            if (error || !hostEscrowId) {
              Alert.alert('Something went wrong', error ?? 'Could not close the group.');
              return;
            }
            onRefresh();
            router.push(`/escrow/${hostEscrowId}` as Href);
          },
        },
      ]
    );
  }, [onRefresh, plan.accepted_guest_count, plan.currency, plan.id, projected]);

  if (!isGroupSplitPlan(plan)) return null;

  if (!isHost) {
    const guestLegFunded = !!(myEscrow && isUserEscrowLegFunded(myEscrow, currentUserId));
    const guestNeedsPayment = !!(myEscrow && !guestLegFunded);
    const guestShareCents =
      myEscrow?.guest_share_cents ?? offer.current_amount_cents ?? offer.amount_cents ?? 0;

    return (
      <View style={styles.wrap}>
        <View style={styles.escrowCard}>
          <Text style={styles.escrowLabel}>Your agreed share</Text>
          <Text style={styles.escrowAmount}>
            {formatGroupSplitCents(guestShareCents, plan.currency)}
          </Text>
          <Text style={styles.escrowNote}>Negotiated and agreed with the host.</Text>
        </View>
        {showPaymentCta && guestNeedsPayment ? (
          <AgreementPrimaryCta
            label={`Complete secure payment · ${formatGroupSplitCents(myEscrow!.guest_share_cents ?? guestShareCents, plan.currency)}`}
            onPress={() => router.push(`/escrow/${myEscrow!.id}` as Href)}
          />
        ) : showPaymentCta && guestLegFunded && myEscrow ? (
          <AgreementPrimaryCta
            label="View payment details"
            onPress={() => router.push(`/escrow/${myEscrow.id}` as Href)}
          />
        ) : null}
        {guestLegFunded ? (
          <View style={styles.fundedBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
            <Text style={styles.fundedText}>Your share is secured.</Text>
          </View>
        ) : null}
        {guestLegFunded && plan.status !== 'active' ? (
          <View style={styles.waitingBanner}>
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <Text style={styles.waitingText}>
              Waiting for the host to close the group and complete their payment.
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  const hostLegFunded = !!(hostEscrow && isUserEscrowLegFunded(hostEscrow, currentUserId));

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Guest contributions</Text>
      {acceptedOffers.map((o) => {
        const esc = escrows.find((e) => e.guest_id === o.bidder_id);
        const prof = profiles[o.bidder_id];
        return (
          <View key={o.id} style={styles.guestRow}>
            <Avatar uri={prof?.avatar_url} name={prof?.display_name ?? 'Guest'} size={40} />
            <View style={styles.guestCopy}>
              <Text style={styles.guestName}>{prof?.display_name?.trim() || 'Guest'}</Text>
              <Text style={styles.guestAmount}>
                {formatGroupSplitCents(o.current_amount_cents ?? o.amount_cents, plan.currency)}
              </Text>
            </View>
            <EscrowStatusBadge status={esc?.status ?? 'pending_funding'} compact />
          </View>
        );
      })}
      <View style={styles.hostShareRow}>
        <Text style={styles.escrowLabel}>Your share</Text>
        {groupClosed && hostEscrow ? (
          <Text style={styles.escrowAmount}>
            {formatGroupSplitCents(hostEscrow.host_share_cents ?? hostEscrow.amount_cents, plan.currency)}
          </Text>
        ) : (
          <Text style={styles.projectedAmount}>
            {formatGroupSplitCents(projected, plan.currency)} (projected)
          </Text>
        )}
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Plan total</Text>
        <Text style={styles.totalAmount}>{formatGroupSplitCents(planTotalCostCents(plan), plan.currency)}</Text>
      </View>
      {!groupClosed && acceptedOffers.length > 0 ? (
        <AgreementPrimaryCta label="Close group and pay my share" onPress={handleCloseGroup} />
      ) : null}
      {groupClosed && hostEscrow && showPaymentCta && !hostLegFunded ? (
        <AgreementPrimaryCta
          label={`Complete host payment · ${formatGroupSplitCents(hostEscrow.host_share_cents ?? hostEscrow.amount_cents, plan.currency)}`}
          onPress={() => router.push(`/escrow/${hostEscrow.id}` as Href)}
        />
      ) : groupClosed && hostEscrow && hostLegFunded ? (
        <AgreementPrimaryCta
          label="View payment details"
          onPress={() => router.push(`/escrow/${hostEscrow.id}` as Href)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  escrowCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  escrowLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  escrowAmount: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  escrowNote: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  guestCopy: { flex: 1, gap: 2 },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  guestAmount: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  hostShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  projectedAmount: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.secondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  primaryOuter: {
    marginTop: spacing.xs,
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
  primaryGrad: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  fundedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  fundedText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.success,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  waitingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 19,
  },
});
