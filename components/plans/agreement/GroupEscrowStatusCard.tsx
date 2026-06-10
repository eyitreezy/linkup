/**
 * Group plan escrow funding summary for host on agreement screen.
 */
import { EscrowStatusBadge } from '@/components/escrow/EscrowStatusBadge';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { DbEscrowTransaction, DbPlan } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type GuestEscrow = {
  bidderId: string;
  name: string;
  funded: boolean;
  escrowId: string | null;
  status: DbEscrowTransaction['status'] | null;
};

type Props = { plan: DbPlan };

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
});

export function GroupEscrowStatusCard({ plan }: Props) {
  const [guests, setGuests] = useState<GuestEscrow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!plan.is_group_plan) {
      setLoading(false);
      return;
    }
    const { data: offers } = await supabase
      .from('plan_offers')
      .select('bidder_id')
      .eq('plan_id', plan.id)
      .eq('status', 'accepted');

    const bidders = (offers ?? []).map((o) => o.bidder_id as string);
    if (bidders.length === 0) {
      setGuests([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: escrows }] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name').in('user_id', bidders),
      supabase
        .from('escrow_transactions')
        .select('id, guest_id, status, group_plan_index')
        .eq('plan_id', plan.id)
        .order('group_plan_index', { ascending: true }),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p.display_name as string]));

    setGuests(
      bidders.map((bid) => {
        const esc = (escrows ?? []).find((e) => e.guest_id === bid);
        const st = (esc?.status as DbEscrowTransaction['status'] | undefined) ?? null;
        const funded = st === 'funded' || st === 'active' || st === 'released';
        return {
          bidderId: bid,
          name: profMap.get(bid) ?? 'Guest',
          funded,
          escrowId: (esc?.id as string) ?? null,
          status: st,
        };
      })
    );
    setLoading(false);
  }, [plan.id, plan.is_group_plan]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!plan.is_group_plan) return null;

  const fundedCount = guests.filter((g) => g.funded).length;
  const total = guests.length;
  const progress = total > 0 ? fundedCount / total : 0;
  const allFunded = total > 0 && fundedCount === total;
  const pending = guests.find((g) => !g.funded);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />

      <View style={styles.headerRow}>
        <LinearGradient
          colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
          style={styles.iconWrap}
        >
          <Ionicons name="people-outline" size={22} color={colors.primary} />
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Group escrow</Text>
          <Text style={styles.title}>Guest funding progress</Text>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>
            {fundedCount} of {total} funded
          </Text>
          <Text style={[styles.progressPct, allFunded && styles.progressPctDone]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <View style={styles.track}>
          <LinearGradient
            colors={allFunded ? [colors.success, '#34D399'] : [...APP_CHIP_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${Math.max(progress * 100, total > 0 ? 4 : 0)}%` }]}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {guests.map((g, idx) => (
            <Pressable
              key={g.bidderId}
              onPress={() => g.escrowId && router.push(`/escrow/${g.escrowId}` as Href)}
              style={({ pressed }) => [
                styles.guestRow,
                idx === 0 && styles.guestRowFirst,
                g.funded && styles.guestRowDone,
                pressed && g.escrowId && styles.guestRowPressed,
              ]}
              disabled={!g.escrowId}
            >
              <View style={[styles.avatar, g.funded && styles.avatarDone]}>
                {g.funded ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={styles.avatarInitial}>{g.name.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.guestRowText}>
                <Text style={styles.guestName}>{g.name}</Text>
                {g.status ? (
                  <EscrowStatusBadge status={g.status} compact />
                ) : (
                  <Text style={styles.pendingTxt}>Awaiting escrow setup</Text>
                )}
              </View>
              {g.escrowId ? (
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      {allFunded ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.successTxt}>All guests funded — plan can go active.</Text>
        </View>
      ) : pending?.escrowId ? (
        <Pressable
          onPress={() => router.push(`/escrow/${pending.escrowId}` as Href)}
          style={({ pressed }) => [styles.ctaRow, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[...APP_CHIP_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Text style={styles.ctaTxt}>View {pending.name}&apos;s escrow</Text>
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
    borderColor: 'rgba(108, 99, 255, 0.14)',
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
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  progressBlock: { marginBottom: spacing.md },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  progressPct: { fontSize: 13, fontWeight: '900', color: colors.primary },
  progressPctDone: { color: colors.success },
  track: {
    height: 8,
    borderRadius: radius.button,
    backgroundColor: colors.authInputBg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  fill: { height: '100%', borderRadius: radius.button },
  loader: { marginVertical: spacing.sm },
  list: { gap: 0 },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.1)',
  },
  guestRowFirst: { borderTopWidth: 0 },
  guestRowDone: { backgroundColor: 'rgba(16, 185, 129, 0.06)' },
  guestRowPressed: { opacity: 0.92 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  avatarDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  avatarInitial: { fontSize: 14, fontWeight: '900', color: colors.primary },
  guestRowText: { flex: 1, gap: 6 },
  guestName: { fontSize: 15, fontWeight: '800', color: colors.text },
  pendingTxt: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
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
  successTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#047857', lineHeight: 18 },
  ctaRow: { marginTop: spacing.sm, borderRadius: radius.button, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
