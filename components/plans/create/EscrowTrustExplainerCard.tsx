/**
 * Hinge-style clarity card for escrow — plan creation step 2.
 */
import { CancellationPolicyRows } from '@/components/plans/CancellationPolicyRows';
import { colors, radius, spacing } from '@/constants/theme';
import { COMMITMENT_CANCELLATION_POLICY_ROWS } from '@/lib/plans/cancellationPolicy';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export function EscrowTrustExplainerCard() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Trust & commitment</Text>
          <Text style={styles.title}>How escrow protects you</Text>
        </View>
      </View>
      <Text style={styles.body}>
        Funds stay in escrow until the meetup completes. Cancellation rules are fixed at agreement and enforced on
        our servers — not negotiated in chat.
      </Text>
      <CancellationPolicyRows rows={COMMITMENT_CANCELLATION_POLICY_ROWS} dense />
      <View style={styles.footnote}>
        <Ionicons name="server-outline" size={14} color={colors.primary} />
        <Text style={styles.footnoteTxt}>Full policy shown again before both parties confirm and pay.</Text>
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.md },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footnoteTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted, lineHeight: 17 },
});
