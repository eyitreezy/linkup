/**
 * Trust-focused cancellation summary (Hinge-style clarity).
 */
import { CancellationPolicyRows } from '@/components/plans/CancellationPolicyRows';
import { colors, radius, spacing } from '@/constants/theme';
import { CANCELLATION_POLICY_TABLE_ROWS } from '@/lib/plans/cancellationPolicy';
import { StyleSheet, Text, View } from 'react-native';

export type CancellationBandSummary = 'early' | 'late' | 'no_show' | 'mutual';

type Props = {
  /** Optional outcome after server RPC (single-party cancel). */
  outcome?: {
    band: CancellationBandSummary;
    refundCents: number;
    feeCents: number;
    goodwillCents?: number;
    roleLabel: 'Host' | 'Guest';
  } | null;
};

export function CancellationSummaryCard({ outcome }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Cancellation policy</Text>
      <Text style={styles.lead}>
        LinkUp applies role- and timing-based rules on the server so outcomes stay fair and predictable.
      </Text>
      <CancellationPolicyRows rows={CANCELLATION_POLICY_TABLE_ROWS} />
      {outcome ? (
        <View style={styles.outcome}>
          <Text style={styles.outcomeTitle}>Latest outcome</Text>
          <Text style={styles.outcomeLine}>
            {outcome.roleLabel} · {outcome.band.replace('_', ' ')}
          </Text>
          <Text style={styles.outcomeLine}>
            Guest release ₦{(outcome.refundCents / 100).toLocaleString()} · Host release ₦
            {(outcome.feeCents / 100).toLocaleString()}
          </Text>
          {(outcome.goodwillCents ?? 0) > 0 ? (
            <Text style={styles.goodwill}>
              Goodwill credit ₦{((outcome.goodwillCents ?? 0) / 100).toLocaleString()} (non-withdrawable)
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    marginBottom: spacing.md,
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8, letterSpacing: -0.3 },
  lead: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  outcome: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  outcomeTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 4 },
  outcomeLine: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  goodwill: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 6 },
});
