/**
 * Hybrid MVP wallet — ledger + goodwill; premium dating-app visuals (trust + monetization).
 */
import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { RefundAccountForm } from '@/components/escrow/RefundAccountForm';
import { GoodwillCreditRow } from '@/components/wallet/GoodwillCreditRow';
import { WalletSkeleton } from '@/components/wallet/WalletSkeleton';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getInvokeErrorMessage } from '@/lib/flutterwave/parsePaymentLink';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbGoodwillCredit, DbUserPaymentAccount, DbWalletLedgerRow } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatMoney(cents: number, currency = 'NGN'): string {
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

function sourcePretty(source: string): string {
  return source.replace(/_/g, ' ');
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [ledger, setLedger] = useState<DbWalletLedgerRow[]>([]);
  const [goodwill, setGoodwill] = useState<DbGoodwillCredit[]>([]);
  const [goodwillHistory, setGoodwillHistory] = useState<DbGoodwillCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disbursementQueue, setDisbursementQueue] = useState<
    { id: string; amount_cents: number; disburse_after: string }[]
  >([]);
  const [savedAccount, setSavedAccount] = useState<DbUserPaymentAccount | null>(null);
  const [unclaimedFunds, setUnclaimedFunds] = useState<{ id: string }[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const load = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setLedger([]);
      setGoodwill([]);
      setGoodwillHistory([]);
      setDisbursementQueue([]);
      setSavedAccount(null);
      setUnclaimedFunds([]);
      setLoading(false);
      return;
    }
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [l, g, gh, dq, sa, uf] = await Promise.all([
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
      supabase
        .from('goodwill_credits')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('wallet_disbursement_queue')
        .select('id, amount_cents, disburse_after')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('user_payment_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle(),
      supabase
        .from('unclaimed_funds')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['pending_account', 'admin_review']),
    ]);
    setLedger((l.data ?? []) as DbWalletLedgerRow[]);
    setGoodwill((g.data ?? []) as DbGoodwillCredit[]);
    setGoodwillHistory((gh.data ?? []) as DbGoodwillCredit[]);
    setDisbursementQueue((dq.data ?? []) as typeof disbursementQueue);
    setSavedAccount((sa.data ?? null) as DbUserPaymentAccount | null);
    setUnclaimedFunds((uf.data ?? []) as typeof unclaimedFunds);
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
      if (row.is_display_only) continue;
      if (row.type === 'credit') n += row.amount;
      else n -= row.amount;
    }
    return n;
  }, [ledger]);

  const expiringSoonCredits = useMemo(() => {
    const in7 = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return goodwillHistory.filter((c) => {
      const exp = new Date(c.expires_at).getTime();
      const remaining = c.amount - c.used_amount;
      return remaining > 0 && exp > Date.now() && exp <= in7;
    });
  }, [goodwillHistory]);

  const expiringSoonTotal = useMemo(
    () => expiringSoonCredits.reduce((n, c) => n + Math.max(c.amount - c.used_amount, 0), 0),
    [expiringSoonCredits]
  );

  const goodwillRemaining = useMemo(() => {
    let n = 0;
    for (const c of goodwill) {
      n += Math.max(c.amount - c.used_amount, 0);
    }
    return n;
  }, [goodwill]);

  const handleWithdraw = async () => {
    if (!savedAccount) {
      setShowAddAccount(true);
      return;
    }
    const amountCents = Math.round(parseFloat(withdrawAmount || '0') * 100);
    if (amountCents <= 0 || amountCents > balanceCents) {
      Alert.alert('Invalid amount', 'Please enter a valid withdrawal amount.');
      return;
    }
    setWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke('disburse-wallet', {
        body: {
          amount_cents: amountCents,
          payment_account_id: savedAccount.id,
        },
      });
      if (error) {
        throw new Error(await getInvokeErrorMessage(error, data));
      }
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      Alert.alert(
        'Withdrawal initiated',
        `Your withdrawal of ${formatMoney(amountCents)} is on its way to your ${savedAccount.bank_name} account.`
      );
      await load();
    } catch {
      Alert.alert('Withdrawal failed', 'Something went wrong. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

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
        <AppShellBackground />

        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <LinearGradient
              colors={[colors.primary, '#8B7CF8', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="wallet" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Your money hub</Text>
              <Text style={styles.heroTitle}>Wallet</Text>
              <Text style={styles.heroSub}>
                See escrow payouts, refunds, and goodwill credits in one place.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {loading ? (
            <WalletSkeleton />
          ) : (
            <>
              <LinearGradient
                colors={['#5E52FF', '#9B8CFF', '#FF4A72']}
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
                  Issued when a host cancels within 48h or no-shows. Offsets platform fees on future escrows · not
                  cash · expires 60 days from issue.
                </Text>
              </LinearGradient>

              {expiringSoonCredits.length > 0 ? (
                <View style={styles.expiryBanner}>
                  <Ionicons name="time-outline" size={18} color="#B45309" />
                  <Text style={styles.expiryBannerText}>
                    {formatMoney(expiringSoonTotal)} in goodwill credits expire within 7 days
                  </Text>
                </View>
              ) : null}

              <View style={styles.sectionHead}>
                <Ionicons name="heart-circle" size={18} color="#D97706" />
                <Text style={styles.section}>Goodwill history</Text>
              </View>

              {goodwillHistory.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="sparkles-outline" size={32} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No goodwill credits yet</Text>
                  <Text style={styles.emptySub}>
                    Credits appear when a host cancels within 48h or no-shows on a plan.
                  </Text>
                </View>
              ) : (
                goodwillHistory.map((credit) => <GoodwillCreditRow key={credit.id} credit={credit} />)
              )}

              {balanceCents > 0 && !savedAccount ? (
                <View style={styles.momentACard}>
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.momentATitle}>Add your bank account</Text>
                    <Text style={styles.momentABody}>
                      Your meetup funds are ready. Add your bank account to receive them.
                    </Text>
                  </View>
                  <Pressable style={styles.momentAButton} onPress={() => setShowAddAccount(true)}>
                    <Text style={styles.momentAButtonLabel}>Add now</Text>
                  </Pressable>
                </View>
              ) : null}

              {disbursementQueue.length > 0 ? (
                <View style={styles.pendingCard}>
                  <View style={styles.pendingHeader}>
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Text style={styles.pendingTitle}>Pending disbursements</Text>
                  </View>
                  {disbursementQueue.map((item) => {
                    const daysLeft = Math.ceil(
                      (new Date(item.disburse_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <View key={item.id} style={styles.pendingRow}>
                        <Text style={styles.pendingAmount}>{formatMoney(item.amount_cents)}</Text>
                        <Text style={styles.pendingDays}>
                          {savedAccount
                            ? `Auto-sends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                            : 'Add bank account to receive'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {unclaimedFunds.length > 0 ? (
                <View style={styles.unclaimedBanner}>
                  <Ionicons name="warning-outline" size={18} color="#B45309" />
                  <Text style={styles.unclaimedText}>
                    You have unclaimed funds. Add your bank account or contact support.
                  </Text>
                </View>
              ) : null}

              {balanceCents > 0 ? (
                <Pressable
                  style={styles.withdrawButton}
                  onPress={() => {
                    if (!savedAccount) {
                      setShowAddAccount(true);
                    } else {
                      setWithdrawAmount(String(balanceCents / 100));
                      setShowWithdrawModal(true);
                    }
                  }}
                >
                  <LinearGradient
                    colors={[colors.primary, '#8B7CF8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.withdrawButtonGradient}
                  >
                    <Ionicons name="arrow-down-circle-outline" size={20} color="#fff" />
                    <Text style={styles.withdrawButtonLabel}>Withdraw funds</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}

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
                ledger.map((row) => {
                  const isGoodwillApplied = row.source === 'goodwill' && row.is_display_only;
                  return (
                  <View key={row.id} style={styles.rowCard}>
                    <View
                      style={[
                        styles.rowStripe,
                        isGoodwillApplied
                          ? styles.stripeGoodwill
                          : row.type === 'credit'
                            ? styles.stripeCredit
                            : styles.stripeDebit,
                      ]}
                    />
                    <View style={styles.rowBody}>
                      <View style={styles.rowLeft}>
                        <View style={styles.rowTypeRow}>
                          {isGoodwillApplied ? (
                            <Ionicons name="sparkles" size={14} color="#D97706" />
                          ) : null}
                          <Text style={styles.rowType}>
                            {isGoodwillApplied
                              ? 'Goodwill applied'
                              : row.type === 'credit'
                                ? 'Credit'
                                : 'Debit'}
                          </Text>
                          <View
                            style={[
                              styles.srcPill,
                              isGoodwillApplied || row.type === 'credit'
                                ? styles.srcPillPos
                                : styles.srcPillNeg,
                            ]}
                          >
                            <Text style={styles.srcPillTxt}>
                              {isGoodwillApplied ? 'fee offset' : sourcePretty(row.source)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.rowDate}>{new Date(row.created_at).toLocaleString()}</Text>
                      </View>
                      <Text
                        style={[
                          styles.rowAmt,
                          isGoodwillApplied && styles.rowAmtGoodwill,
                          row.type === 'debit' && styles.rowAmtDebit,
                        ]}
                      >
                        {isGoodwillApplied ? '−' : row.type === 'credit' ? '+' : '−'}
                        {formatMoney(row.amount)}
                      </Text>
                    </View>
                  </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>

        <Modal
          visible={showWithdrawModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowWithdrawModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowWithdrawModal(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Withdraw funds</Text>

              {savedAccount ? (
                <View style={styles.savedAccountRow}>
                  <Ionicons name="business-outline" size={18} color={colors.primary} />
                  <Text style={styles.savedAccountText}>
                    {savedAccount.bank_name} ending in {savedAccount.account_number.slice(-4)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.amountRow}>
                <Text style={styles.amountCurrency}>NGN</Text>
                <TextInput
                  style={styles.amountInput}
                  value={withdrawAmount}
                  onChangeText={(v) => setWithdrawAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>

              <Text style={styles.balanceHintText}>Available: {formatMoney(balanceCents)}</Text>

              <Pressable
                style={[styles.confirmWithdrawBtn, withdrawing && { opacity: 0.6 }]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                <LinearGradient
                  colors={[colors.primary, '#8B7CF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmWithdrawGradient}
                >
                  {withdrawing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmWithdrawLabel}>Confirm withdrawal</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Text style={styles.withdrawNote}>
                Funds arrive within a few hours. Transfers to most Nigerian banks are fast.
              </Text>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={showAddAccount}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddAccount(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddAccount(false)}>
            <Pressable
              style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
              onPress={() => {}}
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add bank account</Text>
              <RefundAccountForm
                userId={user.id}
                savedAccount={null}
                submitLabel="Save bank account"
                allowOneTime={false}
                onComplete={async () => {
                  setShowAddAccount(false);
                  await load();
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  root: { flex: 1 },
  topNav: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.12)',
  },
  backPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  heroLeft: { flexDirection: 'row', gap: spacing.md, flex: 1, alignItems: 'flex-start' },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  heroTitle: { fontSize: 28, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  heroSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  balanceShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.md,
    shadowColor: '#5E52FF',
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
  balanceLabel: { fontSize: 12, fontWeight: '800',
    fontFamily: fonts.bold, color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' },
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
  liveTxt: { fontSize: 11, fontWeight: '800',
    fontFamily: fonts.bold, color: '#fff' },
  balanceAmt: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 4, fontFamily: fonts.bold, },
  balanceHint: { fontSize: 14, color: 'rgba(255,255,255,0.88)', marginTop: 10, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  balanceFooterTxt: { fontSize: 12, fontWeight: '700',
    fontFamily: fonts.medium, color: 'rgba(255,255,255,0.85)', flex: 1 },
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
  goodwillTitle: { fontSize: 17, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text },
  goodwillAmt: { fontSize: 26, fontWeight: '900', color: '#B45309', marginTop: 8, fontFamily: fonts.bold, },
  goodwillHint: { fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  expiryBanner: {
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
  expiryBannerText: { flex: 1, fontSize: 14, fontWeight: '700',
    fontFamily: fonts.medium, color: '#B45309', lineHeight: 20 },
  momentACard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(94,82,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.2)',
  },
  momentATitle: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  momentABody: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  momentAButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 50,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  momentAButtonLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  pendingCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.15)',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  pendingDays: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  unclaimedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  unclaimedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: '#B45309',
    lineHeight: 20,
  },
  withdrawButton: {
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  withdrawButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
  },
  withdrawButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    gap: spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  savedAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(94,82,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  savedAccountText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  amountCurrency: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  balanceHintText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    fontFamily: fonts.medium,
    textAlign: 'right',
  },
  confirmWithdrawBtn: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  confirmWithdrawGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmWithdrawLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  withdrawNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    fontFamily: fonts.medium,
    textAlign: 'center',
    lineHeight: 18,
    paddingBottom: spacing.md,
  },
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
  stripeGoodwill: { backgroundColor: '#F59E0B' },
  stripeDebit: { backgroundColor: colors.secondary },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowTypeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowType: { fontSize: 15, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text },
  srcPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  srcPillPos: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  srcPillNeg: { backgroundColor: 'rgba(255, 74, 114, 0.15)' },
  srcPillTxt: { fontSize: 11, fontWeight: '800', color: colors.text, textTransform: 'capitalize', fontFamily: fonts.bold, },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600', fontFamily: fonts.medium, },
  rowAmt: { fontSize: 16, fontWeight: '900', color: '#059669', fontFamily: fonts.bold, },
  rowAmtGoodwill: { color: '#B45309' },
  rowAmtDebit: { color: colors.secondary },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, marginTop: spacing.sm },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  muted: { fontSize: 15, color: colors.textMuted, fontFamily: fonts.regular, },
});
