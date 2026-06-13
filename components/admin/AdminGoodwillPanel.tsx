/**
 * Admin — view and issue goodwill credits for a member.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { DbGoodwillCredit, GoodwillSource } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function formatMoney(cents: number): string {
  return `₦${(cents / 100).toLocaleString()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

type Props = {
  userId: string;
  disputeId?: string | null;
};

export function AdminGoodwillPanel({ userId, disputeId }: Props) {
  const [credits, setCredits] = useState<DbGoodwillCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueAmount, setIssueAmount] = useState('');
  const [issueSource, setIssueSource] = useState<GoodwillSource>(
    disputeId ? 'dispute_resolution' : 'promo'
  );
  const [issueNote, setIssueNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('goodwill_credits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) Alert.alert('Goodwill', error.message);
    setCredits((data ?? []) as DbGoodwillCredit[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleIssue() {
    const amountCents = Math.round(parseFloat(issueAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      Alert.alert('Amount', 'Enter a valid NGN amount.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('admin_issue_goodwill_credit', {
      p_user_id: userId,
      p_amount_cents: amountCents,
      p_source: issueSource,
      p_admin_note: issueNote.trim() || null,
      p_dispute_id: disputeId ?? null,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Issue failed', error.message);
      return;
    }
    setIssueAmount('');
    setIssueNote('');
    void load();
    Alert.alert('Issued', 'Goodwill credit added.');
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <Ionicons name="heart-circle" size={20} color="#D97706" />
        <Text style={styles.panelTitle}>Goodwill credits</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : credits.length === 0 ? (
        <Text style={styles.empty}>No goodwill credits for this member.</Text>
      ) : (
        credits.map((credit) => (
          <View key={credit.id} style={styles.creditRow}>
            <Text style={styles.creditAmount}>
              {formatMoney(credit.amount - credit.used_amount)} / {formatMoney(credit.amount)}
            </Text>
            <Text style={styles.creditMeta}>
              {credit.source} · {credit.tier_at_award ?? 'FREE'} · expires {formatDate(credit.expires_at)}
            </Text>
          </View>
        ))
      )}

      <View style={styles.issueForm}>
        <Text style={styles.fieldLbl}>Issue new credit (NGN)</Text>
        <TextInput
          style={styles.inp}
          placeholder="Amount (NGN)"
          keyboardType="decimal-pad"
          value={issueAmount}
          onChangeText={setIssueAmount}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLbl}>Source</Text>
        <View style={styles.choiceRowWrap}>
          {(['promo', 'dispute_resolution'] as GoodwillSource[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setIssueSource(s)}
              style={[styles.choice, issueSource === s && styles.choiceOn]}
            >
              <Text style={[styles.choiceTxt, issueSource === s && styles.choiceTxtOn]}>
                {s.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLbl}>Note (optional, shown to user)</Text>
        <TextInput
          style={[styles.inp, { minHeight: 72 }]}
          placeholder="Note (optional)"
          multiline
          value={issueNote}
          onChangeText={setIssueNote}
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />

        <Pressable style={styles.issueButton} onPress={() => void handleIssue()} disabled={busy}>
          <LinearGradient
            colors={[colors.primary, '#8B7CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.issueButtonLabel}>{busy ? 'Issuing…' : 'Issue goodwill credit'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  panelTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  empty: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.md },
  creditRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  creditAmount: { fontSize: 15, fontWeight: '800', color: colors.text },
  creditMeta: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  issueForm: { marginTop: spacing.md, gap: spacing.xs },
  fieldLbl: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  inp: {
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  choiceRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    backgroundColor: colors.surface,
  },
  choiceOn: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  choiceTxt: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'capitalize' },
  choiceTxtOn: { color: colors.primary },
  issueButton: {
    marginTop: spacing.md,
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueButtonLabel: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
