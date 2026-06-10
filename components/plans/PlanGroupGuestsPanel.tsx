/**
 * Group plan guest panel for host on plan detail.
 */
import { Avatar } from '@/components/Avatar';
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer, EscrowStatus } from '@/types/database';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type GuestRow = {
  offer: DbPlanOffer;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  escrow_status: EscrowStatus | null;
  escrow_id: string | null;
};

type Props = {
  plan: DbPlan;
  hostUserId: string;
  currentUserId: string | undefined;
};

export function PlanGroupGuestsPanel({ plan, hostUserId, currentUserId }: Props) {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!plan.is_group_plan) {
      setLoading(false);
      return;
    }
    const { data: offers } = await supabase
      .from('plan_offers')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('status', 'accepted');

    const accepted = (offers ?? []) as DbPlanOffer[];
    if (accepted.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const bidderIds = accepted.map((o) => o.bidder_id);
    const [{ data: profiles }, { data: users }, { data: escrows }] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', bidderIds),
      supabase.from('users').select('id, subscription_tier').in('id', bidderIds),
      supabase.from('escrow_transactions').select('id, plan_id, payer_id, status').eq('plan_id', plan.id),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const userMap = new Map((users ?? []).map((u) => [u.id as string, u]));

    setRows(
      accepted.map((offer) => {
        const prof = profMap.get(offer.bidder_id);
        const u = userMap.get(offer.bidder_id);
        const esc = (escrows ?? []).find((e) => e.payer_id === offer.bidder_id);
        return {
          offer,
          display_name: (prof?.display_name as string) ?? null,
          avatar_url: (prof?.avatar_url as string) ?? null,
          subscription_tier: (u?.subscription_tier as string) ?? 'FREE',
          escrow_status: (esc?.status as EscrowStatus) ?? null,
          escrow_id: (esc?.id as string) ?? null,
        };
      })
    );
    setLoading(false);
  }, [plan.id, plan.is_group_plan]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!plan.is_group_plan || currentUserId !== hostUserId) return null;

  const maxGuests = plan.max_guests ?? plan.max_free_guests ?? 5;
  const freeCap = plan.max_free_guests ?? 5;
  const freeUsed = rows.filter((r) => r.subscription_tier === 'FREE').length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        Guests ({rows.length} / {maxGuests} accepted)
      </Text>
      <Text style={styles.capHint}>
        {freeUsed} of {freeCap} free guest slots used
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No accepted guests yet.</Text>
      ) : (
        rows.map((r) => (
          <Pressable
            key={r.offer.id}
            style={styles.row}
            onPress={() => {
              if (r.escrow_id) router.push(`/escrow/${r.escrow_id}` as Href);
            }}
          >
            <Avatar uri={r.avatar_url} name={r.display_name ?? '?'} size={40} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{r.display_name ?? 'Guest'}</Text>
              <TierBadge tier={r.subscription_tier as 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM'} compact />
            </View>
            <Text style={styles.escrowStatus}>
              {r.escrow_status === 'funded' || r.escrow_status === 'active' || r.escrow_status === 'released'
                ? '✓ Escrow funded'
                : r.escrow_status === 'pending_funding'
                  ? '⏳ Awaiting escrow'
                  : plan.is_paid
                    ? '⏳ Awaiting escrow'
                    : '✓ Confirmed'}
            </Text>
          </Pressable>
        ))
      )}
      <Pressable onPress={() => router.push(`/plan/${plan.id}/negotiate` as Href)}>
        <Text style={styles.viewOffers}>View all offers →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '900', color: colors.text },
  capHint: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  empty: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  escrowStatus: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  viewOffers: { marginTop: spacing.sm, fontSize: 14, fontWeight: '800', color: colors.primary },
});
