/**
 * Hybrid MVP wallet — ledger + goodwill; premium dating-app visuals (trust + monetization).
 */
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbGoodwillCredit, DbWalletLedgerRow } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function formatMoney(cents: number, currency = 'NGN'): string {
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

function sourcePretty(source: string): string {
  return source.replace(/_/g, ' ');
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [ledger, setLedger] = useState<DbWalletLedgerRow[]>([]);
  const [goodwill, setGoodwill] = useState<DbGoodwillCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setLedger([]);
      setGoodwill([]);
      setLoading(false);
      return;
    }
    const [l, g] = await Promise.all([
      supabase
        .from('wallet_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('goodwill_credits')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(40),
    ]);
    setLedger((l.data ?? []) as DbWalletLedgerRow[]);
    setGoodwill((g.data ?? []) as DbGoodwillCredit[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const balanceCents = useMemo(() => {
    let n = 0;
    for (const row of ledger) {
      if (row.type === 'credit') n += row.amount;
      else n -= row.amount;
    }
    return n;
  }, [ledger]);

  const goodwillRemaining = useMemo(() => {
    let n = 0;
    for (const c of goodwill) {
      n += Math.max(c.amount - c.used_amount, 0);
    }
    return n;
  }, [goodwill]);

  if (!user) {
    return (
      <Screen>
        <Text style={styles.muted}>Sign in to view your wallet.</Text>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <View style={styles.root}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', '#F5F6FA']}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.headerRow}>
            <View style={styles.headerIconWrap}>
              <LinearGradient
                colors={[colors.primary, '#8B7CF8']}
                style={styles.headerIconGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="wallet" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Your money hub</Text>
              <Text style={styles.title}>Wallet</Text>
            </View>
          </View>

          <Text style={styles.sub}>
            Cash from escrow releases and refunds. Goodwill credits can lower fees when things go fairly — plain
            language, no fine print buried in the corner.
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} size="large" />
          ) : (
            <>
              <LinearGradient
                colors={['#6C63FF', '#9B8CFF', '#FF6584']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.balanceShell}
              >
                <View style={styles.balanceInner}>
                  <View style={styles.balanceTop}>
                    <Text style={styles.balanceLabel}>Available balance</Text>
                    <View style={styles.livePill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveTxt}>Live</Text>
                    </View>
                  </View>
                  <Text style={styles.balanceAmt}>{formatMoney(balanceCents)}</Text>
                  <Text style={styles.balanceHint}>Tracked from secure holds, refunds, and releases on your plans.</Text>
                  <View style={styles.balanceFooter}>
                    <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.balanceFooterTxt}>Protected · same stack as escrow</Text>
                  </View>
                </View>
              </LinearGradient>

              <LinearGradient
                colors={['#FFF9E6', '#FFE8F0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.goodwillCard}
              >
                <View style={styles.goodwillHeader}>
                  <Ionicons name="heart-circle" size={22} color="#D97706" />
                  <Text style={styles.goodwillTitle}>Goodwill credits</Text>
                </View>
                <Text style={styles.goodwillAmt}>{formatMoney(goodwillRemaining)}</Text>
                <Text style={styles.goodwillHint}>
                  Non-cash credits from fair outcomes (e.g. cancellations). Auto-apply to fees · expire 60 days from
                  issue.
                </Text>
              </LinearGradient>

              <View style={styles.withdrawCard}>
                <View style={styles.withdrawIcon}>
                  <Ionicons name="time-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.withdrawTitle}>Withdrawals</Text>
                  <Text style={styles.withdrawHint}>
                    Not enabled in this MVP. When we turn them on, requests will show up here for review.
                  </Text>
                </View>
              </View>

              <View style={styles.sectionHead}>
                <Ionicons name="pulse" size={18} color={colors.secondary} />
                <Text style={styles.section}>Recent activity</Text>
              </View>

              {ledger.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="receipt-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No movements yet</Text>
                  <Text style={styles.emptySub}>When you complete paid plans or get refunds, they&apos;ll show here.</Text>
                </View>
              ) : (
                ledger.map((row) => (
                  <View key={row.id} style={styles.rowCard}>
                    <View style={[styles.rowStripe, row.type === 'credit' ? styles.stripeCredit : styles.stripeDebit]} />
                    <View style={styles.rowBody}>
                      <View style={styles.rowLeft}>
                        <View style={styles.rowTypeRow}>
                          <Text style={styles.rowType}>{row.type === 'credit' ? 'Credit' : 'Debit'}</Text>
                          <View style={[styles.srcPill, row.type === 'credit' ? styles.srcPillPos : styles.srcPillNeg]}>
                            <Text style={styles.srcPillTxt}>{sourcePretty(row.source)}</Text>
                          </View>
                        </View>
                        <Text style={styles.rowDate}>{new Date(row.created_at).toLocaleString()}</Text>
                      </View>
                      <Text style={[styles.rowAmt, row.type === 'debit' && styles.rowAmtDebit]}>
                        {row.type === 'credit' ? '+' : '−'}
                        {formatMoney(row.amount)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  headerIconWrap: {
    borderRadius: radius.button,
    overflow: 'hidden',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  headerIconGrad: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  balanceShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.md,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  balanceInner: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.xl - 2,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  balanceLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  liveTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  balanceAmt: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 4 },
  balanceHint: { fontSize: 14, color: 'rgba(255,255,255,0.88)', marginTop: 10, lineHeight: 20, fontWeight: '600' },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  balanceFooterTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', flex: 1 },
  goodwillCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  goodwillHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goodwillTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  goodwillAmt: { fontSize: 26, fontWeight: '900', color: '#B45309', marginTop: 8 },
  goodwillHint: { fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 20, fontWeight: '600' },
  withdrawCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
  },
  withdrawIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  withdrawHint: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  section: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowStripe: { width: 4 },
  stripeCredit: { backgroundColor: '#10B981' },
  stripeDebit: { backgroundColor: colors.secondary },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowTypeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowType: { fontSize: 15, fontWeight: '900', color: colors.text },
  srcPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  srcPillPos: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  srcPillNeg: { backgroundColor: 'rgba(255, 101, 132, 0.15)' },
  srcPillTxt: { fontSize: 11, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  rowAmt: { fontSize: 16, fontWeight: '900', color: '#059669' },
  rowAmtDebit: { color: colors.secondary },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginTop: spacing.sm },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  muted: { fontSize: 15, color: colors.textMuted },
});
