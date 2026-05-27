import { colors, radius, spacing } from '@/constants/theme';
import type { EscrowStatus } from '@/types/database';
import { StyleSheet, Text, View } from 'react-native';

const LABELS: Record<EscrowStatus, { label: string; bg: string; fg: string }> = {
  pending_funding: { label: 'Pending funding', bg: '#EEF2FF', fg: '#4338CA' },
  funded: { label: 'Funded', bg: '#ECFDF5', fg: '#047857' },
  active: { label: 'Active (held)', bg: '#ECFDF5', fg: '#047857' },
  released: { label: 'Released', bg: '#ECFDF5', fg: '#047857' },
  disputed: { label: 'Disputed', bg: '#FEF2F2', fg: colors.danger },
  refunded: { label: 'Refunded', bg: '#F3F4F6', fg: colors.textMuted },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', fg: colors.textMuted },
};

type Props = { status: EscrowStatus };

export function EscrowStatusBadge({ status }: Props) {
  const cfg = LABELS[status] ?? LABELS.pending_funding;
  return (
    <View style={[styles.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.txt, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.button,
  },
  txt: { fontSize: 13, fontWeight: '800' },
});
