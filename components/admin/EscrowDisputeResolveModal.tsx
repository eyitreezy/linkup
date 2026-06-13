import { Button } from '@/components/Button';
import { AppDetailModal } from '@/components/ui/AppDetailModal';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export type EscrowResolveContext = {
  disputeId: string;
  escrowId: string;
  amountCents: number;
  currency: string;
  payerId: string;
  payeeId: string;
  payerLabel: string;
  payeeLabel: string;
};

type Props = {
  context: EscrowResolveContext | null;
  onClose: () => void;
  onResolved: () => void;
};

function formatMoney(cents: number, currency: string): string {
  const sym = currency === 'NGN' ? '₦' : currency + ' ';
  return `${sym}${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function EscrowDisputeResolveModal({ context, onClose, onResolved }: Props) {
  const [note, setNote] = useState('');
  const [splitBps, setSplitBps] = useState('5000');
  const [showSplit, setShowSplit] = useState(false);
  const [issueGoodwillOnResolve, setIssueGoodwillOnResolve] = useState(false);
  const [goodwillAmount, setGoodwillAmount] = useState('');
  const [busy, setBusy] = useState(false);

  if (!context) return null;

  const feeApprox = Math.round(context.amountCents * 0.06);
  const netApprox = Math.max(0, context.amountCents - feeApprox);

  async function resolve(decision: 'release' | 'refund' | 'split') {
    const split = decision === 'split' ? parseInt(splitBps, 10) : null;
    if (decision === 'split' && (split == null || Number.isNaN(split) || split < 0 || split > 10000)) {
      Alert.alert('Split', 'Enter a percentage between 0 and 100.');
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc('admin_resolve_escrow_dispute', {
      p_dispute_id: context.disputeId,
      p_decision: decision,
      p_split_bps: split,
      p_resolution_note: note.trim() || null,
    });
    setBusy(false);

    if (error) {
      Alert.alert('Resolve failed', error.message);
      return;
    }

    if (issueGoodwillOnResolve && goodwillAmount.trim()) {
      const amountCents = Math.round(parseFloat(goodwillAmount) * 100);
      const compensatedId = decision === 'refund' ? context.payerId : context.payeeId;
      if (amountCents > 0 && compensatedId) {
        const gwErr = (
          await supabase.rpc('admin_issue_goodwill_credit', {
            p_user_id: compensatedId,
            p_amount_cents: amountCents,
            p_source: 'dispute_resolution',
            p_admin_note: note.trim() || `Escrow dispute resolution: ${context.disputeId}`,
            p_dispute_id: null,
          })
        ).error;
        if (gwErr) Alert.alert('Goodwill issue failed', gwErr.message);
      }
    }

    setNote('');
    setShowSplit(false);
    setIssueGoodwillOnResolve(false);
    setGoodwillAmount('');
    onResolved();
    onClose();
  }

  function confirm(decision: 'release' | 'refund' | 'split', title: string, message: string) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: decision === 'refund' ? 'destructive' : 'default', onPress: () => void resolve(decision) },
    ]);
  }

  return (
    <AppDetailModal
      visible
      onClose={onClose}
      kicker="Admin"
      title="Escrow resolution"
      icon="wallet-outline"
      primaryLabel="Close"
      contentContainerStyle={styles.scroll}
    >
      <Text style={styles.lead}>Choose how funds should move. This cannot be undone.</Text>

      <Pressable
        style={styles.option}
        onPress={() =>
          confirm(
            'release',
            'Release to payee?',
            `Release ${formatMoney(netApprox, context.currency)} (net) to ${context.payeeLabel}?`
          )
        }
        disabled={busy}
      >
        <Text style={styles.optionTitle}>Release to payee</Text>
        <Text style={styles.optionDesc}>
          Funds go to {context.payeeLabel} — {formatMoney(netApprox, context.currency)} net
        </Text>
      </Pressable>

      <Pressable
        style={[styles.option, styles.optionWarn]}
        onPress={() =>
          confirm(
            'refund',
            'Full refund to payer?',
            `Return ${formatMoney(context.amountCents, context.currency)} to ${context.payerLabel}?`
          )
        }
        disabled={busy}
      >
        <Text style={[styles.optionTitle, styles.optionTitleWarn]}>Full refund to payer</Text>
        <Text style={styles.optionDesc}>
          Return {formatMoney(context.amountCents, context.currency)} to {context.payerLabel}
        </Text>
      </Pressable>

      <Pressable style={styles.option} onPress={() => setShowSplit((v) => !v)} disabled={busy}>
        <View style={styles.optionHead}>
          <Text style={styles.optionTitle}>Custom split</Text>
          <Ionicons name={showSplit ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </View>
        <Text style={styles.optionDesc}>Set payee share as a percentage of net amount</Text>
      </Pressable>

      {showSplit ? (
        <View style={styles.splitBox}>
          <Text style={styles.splitLbl}>Payee receives (% of net)</Text>
          <TextInput
            style={styles.splitInput}
            keyboardType="numeric"
            value={splitBps}
            onChangeText={setSplitBps}
            maxLength={5}
            placeholder="50"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.splitHint}>
            Payee ~{formatMoney(Math.round((netApprox * parseInt(splitBps || '0', 10)) / 10000), context.currency)}
          </Text>
          <Button
            title="Apply split"
            loading={busy}
            onPress={() =>
              confirm('split', 'Apply custom split?', 'Wallet credits will be issued to both parties.')
            }
          />
        </View>
      ) : null}

      <View style={styles.goodwillOptionRow}>
        <Switch value={issueGoodwillOnResolve} onValueChange={setIssueGoodwillOnResolve} />
        <Text style={styles.goodwillOptionLabel}>Also issue goodwill credit to payee</Text>
      </View>
      {issueGoodwillOnResolve ? (
        <TextInput
          style={styles.noteInput}
          placeholder="Amount (NGN)"
          keyboardType="decimal-pad"
          value={goodwillAmount}
          onChangeText={setGoodwillAmount}
          placeholderTextColor={colors.textMuted}
        />
      ) : null}

      <Text style={styles.noteLbl}>Admin note (optional)</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="Internal note — not shown to members"
        placeholderTextColor={colors.textMuted}
        multiline
        value={note}
        onChangeText={setNote}
        textAlignVertical="top"
      />
    </AppDetailModal>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.lg },
  lead: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionWarn: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  optionTitleWarn: {
    color: colors.danger,
  },
  optionDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 19,
  },
  splitBox: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    backgroundColor: 'rgba(108, 99, 255, 0.05)',
    gap: spacing.sm,
  },
  splitLbl: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  splitInput: {
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  splitHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  noteLbl: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  noteInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  goodwillOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  goodwillOptionLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
});
