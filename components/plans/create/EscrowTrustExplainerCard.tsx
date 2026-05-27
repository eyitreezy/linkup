/**
 * Hinge-style clarity cards for escrow — step 2 companion.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export function EscrowTrustExplainerCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
        <Text style={styles.title}>How commitment helps</Text>
      </View>
      <Text style={styles.body}>
        Escrow holds funds with Paystack until you both complete the meetup. Cancellation windows and refunds follow the
        policy you both see at agreement time — enforced on our servers, not in chat.
      </Text>
      <View style={styles.bullets}>
        <Text style={styles.li}>· Full refund: cancel &gt;24h before the meetup time.</Text>
        <Text style={styles.li}>· Partial refund: 6–24h window.</Text>
        <Text style={styles.li}>· Last-minute can carry fees — see agreement modal before paying.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm },
  bullets: { gap: 6 },
  li: { fontSize: 13, color: colors.text, lineHeight: 19, fontWeight: '600' },
});
