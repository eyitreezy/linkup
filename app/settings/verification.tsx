import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isUserVerified } from '@/lib/verification/access';
import { Href, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function VerificationStatusScreen() {
  const { dbUser } = useAuth();
  const v = dbUser?.verification_status ?? 'unverified';
  const ok = isUserVerified(v);

  return (
    <Screen scroll>
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.val}>{v}</Text>
        <Text style={styles.body}>
          Verification is required to create plans, negotiate offers, and use escrow. Premium does not replace this step.
        </Text>
        {!ok ? (
          <Button title="Start or resume verification" onPress={() => router.push('/kyc' as Href)} style={{ marginTop: spacing.md }} />
        ) : (
          <Text style={styles.ok}>You&apos;re verified for trust-gated features.</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  val: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4, textTransform: 'capitalize' },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginTop: spacing.md },
  ok: { marginTop: spacing.md, fontSize: 15, fontWeight: '700', color: colors.success },
});
