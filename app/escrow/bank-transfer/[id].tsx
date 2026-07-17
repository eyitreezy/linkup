import { Button } from '@/components/Button';
import { EscrowScreenHeader } from '@/components/escrow/EscrowScreenHeader';
import { RefundAccountForm, type RefundAccountResult } from '@/components/escrow/RefundAccountForm';
import { Screen } from '@/components/Screen';
import { DiscoveryGradientBg } from '@/components/ui/DiscoveryGradientBg';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { canUserAccessBankTransfer } from '@/lib/escrow/escrowBankTransferAccess';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { isUserEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { generateVirtualAccount, fetchSavedPaymentAccount } from '@/lib/escrow/virtualAccountPayment';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';
import { isGroupSplitPlan } from '@/lib/plans/groupSplitDynamic';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbEscrowTransaction, DbUserPaymentAccount } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type VirtualAccountState = {
  sessionId: string;
  accountNumber: string;
  bankName: string;
  amountCents: number;
  expiresAt: string;
};

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function resolveEscrowLeg(
  escrow: Pick<DbEscrowTransaction, 'escrow_pattern' | 'host_id' | 'guest_id' | 'host_funded_at' | 'guest_funded_at'>,
  userId: string
): 'host' | 'guest' | undefined {
  const pattern = escrow.escrow_pattern ?? 'A';
  if (pattern !== 'B') return undefined;
  if (userId === escrow.host_id && !escrow.host_funded_at) return 'host';
  if (userId === escrow.guest_id && !escrow.guest_funded_at) return 'guest';
  return undefined;
}

export default function BankTransferScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading } = useAuth();
  const [escrow, setEscrow] = useState<DbEscrowTransaction | null>(null);
  const [savedAccount, setSavedAccount] = useState<DbUserPaymentAccount | null>(null);
  const [loadDone, setLoadDone] = useState(false);
  const [step, setStep] = useState<'refund_account' | 'virtual_account'>('refund_account');
  const [va, setVa] = useState<VirtualAccountState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdownMs, setCountdownMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  const escrowLeg =
    escrow && user?.id
      ? getEscrowFundingUiState(escrow, user.id).escrowLeg ?? resolveEscrowLeg(escrow, user.id)
      : undefined;
  const successHref = escrow ? (`/plan/${escrow.plan_id}/agreement` as Href) : undefined;

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!id || !user?.id || !isSupabaseConfigured) {
      setLoadDone(true);
      return;
    }

    const { data: escrowRow } = await supabase
      .from('escrow_transactions')
      .select(
        'id, amount_cents, plan_id, status, escrow_pattern, host_id, guest_id, payer_id, host_funded_at, guest_funded_at, host_share_cents, guest_share_cents, currency'
      )
      .eq('id', id)
      .maybeSingle();

    if (!escrowRow) {
      setEscrow(null);
      setLoadDone(true);
      return;
    }

    const { data: planRow } = await supabase
      .from('plans')
      .select(
        'id, is_group_plan, is_paid, escrow_pattern, host_escrow_id, group_closed_at, starting_price_cents, agreed_price_cents, accepted_guest_amounts_sum_cents, budget_min_cents, budget_max_cents'
      )
      .eq('id', escrowRow.plan_id)
      .maybeSingle();

    let guestEscrowRows: Pick<DbEscrowTransaction, 'guest_id' | 'guest_share_cents' | 'amount_cents'>[] = [];
    let hostEscrowRow: DbEscrowTransaction | null = null;
    if (planRow && isGroupSplitPlan(planRow)) {
      const [guestRes, hostRes] = await Promise.all([
        supabase
          .from('escrow_transactions')
          .select('id, guest_id, guest_share_cents, amount_cents, status, host_share_cents')
          .eq('plan_id', escrowRow.plan_id)
          .not('guest_id', 'is', null),
        planRow.host_escrow_id
          ? supabase
              .from('escrow_transactions')
              .select('id, guest_id, host_share_cents, amount_cents, host_funded_at')
              .eq('id', planRow.host_escrow_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      guestEscrowRows = (guestRes.data ?? []) as Pick<
        DbEscrowTransaction,
        'guest_id' | 'guest_share_cents' | 'amount_cents'
      >[];
      hostEscrowRow = hostRes.data ? (hostRes.data as DbEscrowTransaction) : null;
    }

    if (
      !canUserAccessBankTransfer(escrowRow as DbEscrowTransaction, user.id, {
        plan: planRow,
        guestEscrowRows,
        hostEscrowRow,
      })
    ) {
      setEscrow(null);
      setLoadDone(true);
      return;
    }

    setEscrow(escrowRow as DbEscrowTransaction);
    const saved = await fetchSavedPaymentAccount(user.id);
    setSavedAccount(saved);
    setLoadDone(true);
  }, [authLoading, id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFunded = useCallback(() => {
    if (successHref) {
      router.replace(successHref);
    } else {
      goBackOrFallback();
    }
  }, [successHref]);

  useEffect(() => {
    if (authLoading) return;
    if (!loadDone) return;
    if (!escrow) {
      if (id) router.replace(`/escrow/${id}` as Href);
      else goBackOrFallback();
    }
  }, [authLoading, escrow, id, loadDone]);

  useEffect(() => {
    if (step !== 'virtual_account' || !va) return;

    const tick = () => {
      const remaining = new Date(va.expiresAt).getTime() - Date.now();
      setCountdownMs(remaining);
      setIsExpired(remaining <= 0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [step, va]);

  useEffect(() => {
    if (step !== 'virtual_account' || !escrow || !user?.id) return;

    const poll = setInterval(() => {
      void (async () => {
        const { data } = await supabase
          .from('escrow_transactions')
          .select(
            'id, status, escrow_pattern, host_id, guest_id, host_funded_at, guest_funded_at, amount_cents, host_share_cents, guest_share_cents'
          )
          .eq('id', escrow.id)
          .maybeSingle();
        if (!data) return;
        const row = data as DbEscrowTransaction;
        if (row.status === 'funded' || row.status === 'active' || isUserEscrowLegFunded(row, user.id)) {
          handleFunded();
        }
      })();
    }, 3000);

    const channel = supabase
      .channel(`va-session-${escrow.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'virtual_account_sessions',
          filter: `escrow_id=eq.${escrow.id}`,
        },
        (payload) => {
          const next = payload.new as { status?: string };
          if (next.status === 'funded') handleFunded();
        }
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [escrow, handleFunded, step, user?.id]);

  async function onRefundComplete(result: RefundAccountResult) {
    if (!escrow) return;
    setBusy(true);
    setError(null);
    try {
      const params =
        result.mode === 'saved'
          ? { escrowId: escrow.id, escrowLeg, refundAccountId: result.accountId }
          : {
              escrowId: escrow.id,
              escrowLeg,
              oneTimeRefundBankCode: result.bankCode,
              oneTimeRefundAccountNumber: result.accountNumber,
              oneTimeRefundAccountName: result.accountName,
            };
      const session = await generateVirtualAccount(params);
      setVa({
        sessionId: session.session_id,
        accountNumber: session.account_number,
        bankName: session.bank_name,
        amountCents: session.amount_cents,
        expiresAt: session.expires_at,
      });
      setStep('virtual_account');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate virtual account');
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!va) return;
    try {
      await Clipboard.setStringAsync(va.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy account number');
    }
  }

  if (authLoading || !loadDone || !escrow || !user?.id) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
        <DiscoveryGradientBg />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  const currency = escrow.currency ?? 'NGN';

  const pageBody = (
    <>
      <EscrowScreenHeader title="Bank transfer" contained />

      <View style={styles.heroCard}>
        <View style={styles.heroAccent} />
        <View style={styles.heroBody}>
          <Text style={styles.heroKicker}>Bank transfer</Text>
          <Text style={styles.heroTitle}>
            {step === 'refund_account' ? 'Refund account' : 'Transfer payment'}
          </Text>
          <Text style={styles.heroBodyTxt}>
            {step === 'refund_account'
              ? 'We need your bank details in case a refund is required.'
              : 'Send the exact amount to the account below. Your escrow confirms automatically once received.'}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTxt}>{error}</Text>
        </View>
      ) : null}

      {copied ? (
        <View style={styles.copiedBanner}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.copiedTxt}>Copied!</Text>
        </View>
      ) : null}

      {step === 'refund_account' ? (
        <RefundAccountForm userId={user.id} savedAccount={savedAccount} onComplete={onRefundComplete} busy={busy} />
      ) : va ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardKicker}>Transfer payment to</Text>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Bank</Text>
              <Text style={styles.detailValue}>{va.bankName}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Account number</Text>
              <View style={styles.accountRow}>
                <Text style={styles.accountNumber}>{va.accountNumber}</Text>
                <Pressable onPress={() => void onCopy()} style={styles.copyBtn} accessibilityLabel="Copy account number">
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Exact amount</Text>
              <Text style={styles.amountValue}>{formatEscrowMoney(va.amountCents, currency)}</Text>
            </View>
            <View style={styles.countdownRow}>
              <Ionicons name="time-outline" size={18} color={isExpired ? colors.danger : colors.textMuted} />
              {isExpired ? (
                <Text style={styles.expiredTxt}>Account expired</Text>
              ) : (
                <Text style={styles.countdownTxt}>
                  Expires in <Text style={styles.countdownEm}>{formatCountdown(countdownMs)}</Text>
                </Text>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardKicker}>Important</Text>
            <Text style={styles.bullet}>• Transfer the exact amount shown above.</Text>
            <Text style={styles.bullet}>• Only transfer from the account you provided.</Text>
            <Text style={styles.bullet}>• Your escrow will be confirmed automatically once payment is received.</Text>
          </View>

          {isExpired ? (
            <Button
              title="Generate new account"
              variant="ghost"
              onPress={() => {
                setVa(null);
                setStep('refund_account');
                setIsExpired(false);
              }}
              fullWidth
            />
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
      <DiscoveryGradientBg />
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {pageBody}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  heroAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  heroBody: {
    padding: spacing.lg,
    paddingLeft: spacing.lg + 4,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  heroBodyTxt: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 21,
  },
  errorBanner: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
  },
  errorBannerTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.danger,
    lineHeight: 20,
  },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
  },
  copiedTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.success,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    gap: spacing.md,
  },
  cardKicker: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailBlock: { gap: 4 },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accountNumber: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  copyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(237, 232, 255, 0.5)',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  countdownTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  countdownEm: {
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  expiredTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.danger,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 21,
  },
});
