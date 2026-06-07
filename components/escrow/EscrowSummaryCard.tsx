import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Ion = ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, value, emphasize }: { icon: Ion; label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={emphasize ? colors.primary : colors.textMuted} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, emphasize && styles.rowValueEm]}>{value}</Text>
      </View>
    </View>
  );
}

type Props = {
  amountLabel: string;
  currency: string;
  paymentStatusLabel: string;
  whenLabel: string;
  locationLabel: string;
  trustNote: string;
  /** e.g. "Your share" when split escrow — shown above total. */
  yourShareLabel?: string | null;
};

export function EscrowSummaryCard({
  amountLabel,
  currency,
  paymentStatusLabel,
  whenLabel,
  locationLabel,
  trustNote,
  yourShareLabel,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Escrow summary</Text>
      {yourShareLabel ? (
        <Row icon="wallet-outline" label="Your payment" value={yourShareLabel} emphasize />
      ) : null}
      <Row
        icon="cash-outline"
        label={yourShareLabel ? 'Total held' : 'Amount'}
        value={`${amountLabel} ${currency}`}
        emphasize={!yourShareLabel}
      />
      <Row icon="card-outline" label="Payment status" value={paymentStatusLabel} />
      <Row icon="time-outline" label="When" value={whenLabel} />
      <Row icon="location-outline" label="Where" value={locationLabel} />
      <View style={styles.trust}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
        <Text style={styles.trustTxt}>{trustNote}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 },
  rowValueEm: { fontSize: 18, fontWeight: '800', color: colors.primary },
  trust: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  trustTxt: { flex: 1, fontSize: 14, color: '#065F46', lineHeight: 20, fontWeight: '600' },
});
