import { kycColors } from '@/components/kyc/kycTheme';
import { radius, spacing } from '@/constants/theme';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Light optional reminder on Home when the user is still unverified. */
export function VerificationNudgeBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.inner} onPress={() => router.push('/kyc' as Href)} accessibilityRole="button">
        <Text style={styles.txt}>
          <Text style={styles.bold}>Verify in a few minutes</Text> — unlock plans, negotiation, and escrow.
        </Text>
      </Pressable>
      <Pressable hitSlop={8} onPress={() => setDismissed(true)} accessibilityLabel="Dismiss">
        <Text style={styles.dismiss}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    backgroundColor: '#EDE9FF',
    borderRadius: radius.button,
    gap: spacing.xs,
  },
  inner: { flex: 1 },
  txt: { fontSize: 13, color: kycColors.text, lineHeight: 19 },
  bold: { fontWeight: '800', color: kycColors.primary },
  dismiss: { fontSize: 22, color: kycColors.muted, paddingHorizontal: spacing.sm },
});
