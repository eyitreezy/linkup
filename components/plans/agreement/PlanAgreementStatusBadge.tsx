/**
 * PL6a — dual-line status (inbox-style gradient pill + subcopy).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  primary: string;
  secondary: string;
};

export function PlanAgreementStatusBadge({ primary, secondary }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <LinearGradient
        colors={[colors.primary, '#8B7CE8', colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pillRing}
      >
        <View style={styles.pillInner}>
          <Text style={styles.primary}>{primary}</Text>
        </View>
      </LinearGradient>
      <Text style={styles.secondary}>{secondary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  pillRing: {
    padding: 2,
    borderRadius: radius.button,
    marginBottom: spacing.sm,
  },
  pillInner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.button - 2,
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  primary: { fontSize: 13, fontWeight: '900', color: colors.primary, letterSpacing: 0.5, textAlign: 'center' },
  secondary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
});
