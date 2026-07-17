/**
 * Group plan guest panel for host on plan detail.
 */
import { Avatar } from '@/components/Avatar';
import { TierBadge } from '@/components/TierBadge';
import { SkeletonBox } from '@/components/ui/SkeletonBox';
import { APP_CHIP_GRADIENT, APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { subscribeEscrowRealtime } from '@/lib/escrow/subscribeEscrowRealtime';
import {
  findGuestEscrowForBidder,
  guestEscrowStatusLabel,
  isGuestEscrowFunded,
} from '@/lib/plans/groupGuestEscrowDisplay';
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type GuestRow = {
  offer: DbPlanOffer;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  escrow_id: string | null;
  funded: boolean;
  statusLabel: string;
};

type Props = {
  plan: DbPlan;
  hostUserId: string;
  currentUserId: string | undefined;
  /** When parent already loaded offers, skip the initial offers query. */
  seedAcceptedOffers?: DbPlanOffer[];
  offersReady?: boolean;
  /** Bumps when parent realtime refreshes offers / plan (escrow, accepts). */
  refreshKey?: string;
  /** Show Invite on the card header (far right), like the hero Group pill. */
  showInvite?: boolean;
  inviteDisabled?: boolean;
  onInvitePress?: () => void;
};

export function PlanGroupGuestsPanel({
  plan,
  hostUserId,
  currentUserId,
  seedAcceptedOffers,
  offersReady = false,
  refreshKey,
  showInvite = false,
  inviteDisabled = false,
  onInvitePress,
}: Props) {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    if (!plan.is_group_plan) {
      setLoading(false);
      return;
    }

    if (rowsRef.current.length === 0) setLoading(true);

    let accepted: DbPlanOffer[];
    if (seedAcceptedOffers && offersReady) {
      accepted = seedAcceptedOffers;
    } else {
      const { data: offers } = await supabase
        .from('plan_offers')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('status', 'accepted');
      accepted = (offers ?? []) as DbPlanOffer[];
    }

    if (accepted.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const bidderIds = accepted.map((o) => o.bidder_id);
    const [{ data: profiles }, { data: users }, { data: escrows }] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', bidderIds),
      supabase.from('users').select('id, subscription_tier').in('id', bidderIds),
      supabase
        .from('escrow_transactions')
        .select('id, plan_id, payer_id, guest_id, status, escrow_pattern, host_funded_at, guest_funded_at')
        .eq('plan_id', plan.id)
        .not('guest_id', 'is', null),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const userMap = new Map((users ?? []).map((u) => [u.id as string, u]));
    const escrowList = escrows ?? [];

    setRows(
      accepted.map((offer) => {
        const prof = profMap.get(offer.bidder_id);
        const u = userMap.get(offer.bidder_id);
        const esc = findGuestEscrowForBidder(escrowList, offer.bidder_id);
        const funded = isGuestEscrowFunded(esc ?? null, offer.bidder_id);
        return {
          offer,
          display_name: (prof?.display_name as string) ?? null,
          avatar_url: (prof?.avatar_url as string) ?? null,
          subscription_tier: (u?.subscription_tier as string) ?? 'FREE',
          escrow_id: (esc?.id as string) ?? null,
          funded,
          statusLabel: guestEscrowStatusLabel(esc ?? null, offer.bidder_id, !!plan.is_paid),
        };
      })
    );
    setLoading(false);
  }, [
    plan.id,
    plan.is_group_plan,
    plan.is_paid,
    offersReady,
    refreshKey,
    seedAcceptedOffers?.map((o) => `${o.id}:${o.status}:${o.current_amount_cents ?? o.amount_cents}`).join(','),
  ]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!plan.is_group_plan) return;
    return subscribeEscrowRealtime({
      planId: plan.id,
      onRefresh: () => {
        void loadRef.current();
      },
    });
  }, [plan.id, plan.is_group_plan]);

  if (!plan.is_group_plan || currentUserId !== hostUserId) return null;

  const maxGuests = plan.max_guests ?? plan.max_free_guests ?? 5;
  const freeCap = plan.max_free_guests ?? 5;
  const freeUsed = rows.filter((r) => r.subscription_tier === 'FREE').length;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          Guests ({rows.length} / {maxGuests} accepted)
        </Text>
        {showInvite && onInvitePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite guests"
            onPress={onInvitePress}
            disabled={inviteDisabled}
            style={({ pressed }) => [
              styles.inviteBtnOuter,
              inviteDisabled && styles.inviteBtnDisabled,
              pressed && !inviteDisabled && { opacity: 0.92 },
            ]}
          >
            <LinearGradient
              colors={inviteDisabled ? [colors.border, colors.border] : [...APP_CTA_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.inviteBtnGrad}
            >
              <Ionicons name="person-add-outline" size={14} color="#FFFFFF" />
              <Text style={styles.inviteBtnTxt}>Invite</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.capHint}>
        {freeUsed} of {freeCap} free guest slots used
      </Text>
      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1].map((k) => (
            <View key={k} style={styles.skeletonRow}>
              <SkeletonBox style={styles.skeletonAvatar} />
              <View style={styles.skeletonCopy}>
                <SkeletonBox style={styles.skeletonLine} />
                <SkeletonBox style={styles.skeletonLineShort} />
              </View>
            </View>
          ))}
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No accepted guests yet.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.offer.id} style={styles.row}>
            <Avatar uri={r.avatar_url} name={r.display_name ?? '?'} size={40} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{r.display_name ?? 'Guest'}</Text>
              <TierBadge tier={r.subscription_tier as 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM'} compact />
            </View>
            <View style={styles.rowActions}>
              <View style={[styles.statusPill, r.funded && styles.statusPillFunded]}>
                <Ionicons
                  name={r.funded ? 'checkmark-circle' : 'time-outline'}
                  size={13}
                  color={r.funded ? colors.success : colors.textMuted}
                />
                <Text style={[styles.statusPillTxt, r.funded && styles.statusPillTxtFunded]}>
                  {r.statusLabel}
                </Text>
              </View>
              {r.escrow_id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${r.display_name ?? 'guest'} escrow`}
                  onPress={() => router.push(`/escrow/${r.escrow_id}` as Href)}
                  style={({ pressed }) => [styles.escrowBtnOuter, pressed && { opacity: 0.92 }]}
                >
                  <LinearGradient
                    colors={[...APP_CHIP_GRADIENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.escrowBtnGrad}
                  >
                    <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                    <Text style={styles.escrowBtnTxt}>Escrow</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
      <Pressable
        onPress={() => router.push(`/plan/${plan.id}/negotiate` as Href)}
        style={({ pressed }) => [styles.viewOffersHit, pressed && { opacity: 0.88 }]}
      >
        <Text style={styles.viewOffers}>View all offers →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    minWidth: 0,
  },
  inviteBtnOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  inviteBtnDisabled: {
    opacity: 0.55,
  },
  inviteBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 78,
    justifyContent: 'center',
  },
  inviteBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  capHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.sm,
    fontFamily: fonts.medium,
  },
  empty: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.regular },
  skeletonList: { gap: spacing.sm, marginVertical: spacing.sm },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
  skeletonCopy: { flex: 1, gap: 6 },
  skeletonLine: { height: 14, width: '55%', borderRadius: 6 },
  skeletonLineShort: { height: 12, width: '35%', borderRadius: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(94, 82, 255, 0.1)',
  },
  rowBody: { flex: 1, gap: 4, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: fonts.medium },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    maxWidth: 96,
  },
  statusPillFunded: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusPillTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  statusPillTxtFunded: { color: colors.success },
  escrowBtnOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  escrowBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 78,
    justifyContent: 'center',
  },
  escrowBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: 0.2,
  },
  viewOffersHit: { marginTop: spacing.sm, alignSelf: 'flex-start', paddingVertical: 4 },
  viewOffers: { fontSize: 14, fontWeight: '800', color: colors.primary, fontFamily: fonts.bold },
});
