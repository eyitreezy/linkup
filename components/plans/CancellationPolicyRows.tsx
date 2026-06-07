/**
 * Shared cancellation policy rows — matches trust cards (dot + label + value).
 */
import { colors, spacing } from '@/constants/theme';
import type { PolicyTableRow } from '@/lib/plans/cancellationPolicy';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  rows: readonly PolicyTableRow[];
  /** Tighter spacing for inline sections (e.g. agreement modal). */
  dense?: boolean;
};

export function CancellationPolicyRows({ rows, dense }: Props) {
  return (
    <View style={[styles.table, dense && styles.tableDense]}>
      {rows.map((row) => (
        <PolicyRow key={row.label} label={row.label} value={row.value} tone={row.tone} dense={dense} />
      ))}
    </View>
  );
}

type GroupProps = {
  groups: readonly { title: string; rows: readonly PolicyTableRow[] }[];
  dense?: boolean;
};

export function CancellationPolicyRowGroups({ groups, dense }: GroupProps) {
  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <CancellationPolicyRows rows={group.rows} dense={dense} />
        </View>
      ))}
    </View>
  );
}

function PolicyRow({
  label,
  value,
  tone,
  dense,
}: PolicyTableRow & { dense?: boolean }) {
  const dot =
    tone === 'ok' ? colors.success : tone === 'warn' ? colors.secondary : colors.textMuted;
  return (
    <View style={[styles.row, dense && styles.rowDense]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, dense && styles.rowLabelDense]}>{label}</Text>
        <Text style={[styles.rowValue, dense && styles.rowValueDense]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.md },
  group: { gap: spacing.xs },
  groupTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  table: { gap: spacing.sm },
  tableDense: { gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowDense: { gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  rowLabelDense: { fontSize: 13 },
  rowValue: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  rowValueDense: { fontSize: 12, lineHeight: 17 },
});
