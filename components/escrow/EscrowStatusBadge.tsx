import { colors, radius, spacing } from '@/constants/theme';
import type { EscrowStatus } from '@/types/database';
import { StyleSheet, Text, View } from 'react-native';

const LABELS: Record<EscrowStatus, { label: string; bg: string; fg: string; dot: string; border: string }> = {
  pending_funding: {
    label: 'Pending funding',
    bg: 'rgba(108, 99, 255, 0.1)',
    fg: colors.primary,
    dot: colors.primary,
    border: 'rgba(108, 99, 255, 0.22)',
  },
  funded: {
    label: 'Funded',
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: '#047857',
    dot: colors.success,
    border: 'rgba(16, 185, 129, 0.28)',
  },
  active: {
    label: 'Active (held)',
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: '#047857',
    dot: colors.success,
    border: 'rgba(16, 185, 129, 0.28)',
  },
  released: {
    label: 'Released',
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: '#047857',
    dot: colors.success,
    border: 'rgba(16, 185, 129, 0.28)',
  },
  disputed: {
    label: 'Disputed',
    bg: 'rgba(239, 68, 68, 0.1)',
    fg: colors.danger,
    dot: colors.danger,
    border: 'rgba(239, 68, 68, 0.28)',
  },
  refunded: {
    label: 'Refunded',
    bg: colors.authInputBg,
    fg: colors.textMuted,
    dot: colors.textMuted,
    border: '#D8DCE6',
  },
  cancelled: {
    label: 'Cancelled',
    bg: colors.authInputBg,
    fg: colors.textMuted,
    dot: colors.textMuted,
    border: '#D8DCE6',
  },
};

type Props = { status: EscrowStatus; compact?: boolean };

export function EscrowStatusBadge({ status, compact }: Props) {
  const cfg = LABELS[status] ?? LABELS.pending_funding;
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.txt, compact && styles.txtCompact, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  wrapCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  txt: { fontSize: 13, fontWeight: '800' },
  txtCompact: { fontSize: 11, fontWeight: '800' },
});
