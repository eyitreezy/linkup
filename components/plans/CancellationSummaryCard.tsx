/**
 * Trust-focused cancellation summary (Hinge-style clarity).
 */
import { colors, radius, spacing } from '@/constants/theme';
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
        LinkUp applies time-based rules on the server so outcomes stay fair and predictable.
      </Text>
      <View style={styles.table}>
        <Row label="More than 24h before meetup" value="Full refund to payer" tone="ok" />
        <Row label="6–24h before" value="Partial refund (≈70% to payer)" tone="muted" />
        <Row label="Under 6h" value="Stronger fee — smaller refund (≈40%)" tone="warn" />
        <Row label="No-show" value="Maximum fee / minimal refund" tone="warn" />
        <Row label="Mutual cancel" value="Neutral — both agree in-app" tone="ok" />
      </View>
      {outcome ? (
        <View style={styles.outcome}>
          <Text style={styles.outcomeTitle}>Latest outcome</Text>
          <Text style={styles.outcomeLine}>
            {outcome.roleLabel} · {outcome.band.replace('_', ' ')}
          </Text>
          <Text style={styles.outcomeLine}>
            Refund ₦{(outcome.refundCents / 100).toLocaleString()} · Fee ₦
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

function Row({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'muted' | 'warn' }) {
  const dot =
    tone === 'ok' ? colors.success : tone === 'warn' ? colors.secondary : colors.textMuted;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
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
  table: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  rowValue: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
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
