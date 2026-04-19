/**
 * PL6a — dual-line status (Hinge-style trust copy).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  primary: string;
  secondary: string;
};

export function PlanAgreementStatusBadge({ primary, secondary }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.pill}>
        <Text style={styles.primary}>{primary}</Text>
      </View>
      <Text style={styles.secondary}>{secondary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.lg },
  pill: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  primary: { fontSize: 13, fontWeight: '800', color: colors.primary, letterSpacing: 0.4 },
  secondary: { fontSize: 15, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
});
