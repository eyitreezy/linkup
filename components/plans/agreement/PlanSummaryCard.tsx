/**
 * PL6a — Bumble-style structured plan summary.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IonName = ComponentProps<typeof Ionicons>['name'];

type RowProps = { icon: IonName; label: string; value: string; emphasize?: boolean };

function SummaryRow({ icon, label, value, emphasize }: RowProps) {
  return (
    <View style={[styles.row, emphasize && styles.rowEmphasize]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={emphasize ? colors.primary : colors.textMuted} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, emphasize && styles.rowValueEm]}>{value}</Text>
      </View>
    </View>
  );
}

type Props = {
  planTitle: string;
  location: string | null;
  whenLabel: string;
  priceLabel: string;
  notes: string | null;
};

export function PlanSummaryCard({ planTitle, location, whenLabel, priceLabel, notes }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Plan summary</Text>
      <Text style={styles.planTitle}>{planTitle}</Text>
      <SummaryRow icon="location-outline" label="Location" value={location ?? 'Location TBD'} />
      <SummaryRow icon="time-outline" label="Time & date" value={whenLabel} emphasize />
      <SummaryRow icon="cash-outline" label="Agreed price" value={priceLabel} emphasize />
      {notes ? <SummaryRow icon="document-text-outline" label="Notes" value={notes} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  planTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.md, lineHeight: 26 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowEmphasize: { backgroundColor: 'rgba(108, 99, 255, 0.04)', marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  iconWrap: { width: 36, alignItems: 'center', paddingTop: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  rowValue: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 },
  rowValueEm: { fontSize: 17, fontWeight: '800', color: colors.text },
});
