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
};

export function EscrowSummaryCard({
  amountLabel,
  currency,
  paymentStatusLabel,
  whenLabel,
  locationLabel,
  trustNote,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Escrow summary</Text>
      <Row icon="cash-outline" label="Amount" value={`${amountLabel} ${currency}`} emphasize />
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
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
