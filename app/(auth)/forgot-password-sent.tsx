/**
 * Forgot password — email sent confirmation.
 */
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ForgotPasswordSentScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <DatingAuthShell showHeroCopy={false} showPagination={false}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
      </View>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        {email ? (
          <>
            We sent a reset link to <Text style={styles.em}>{email}</Text>. Open it on this device to set a new
            password.
          </>
        ) : (
          'We sent a password reset link. Open it on this device to continue.'
        )}
      </Text>
      <Text style={styles.hint}>
        Open the email on <Text style={styles.em}>this phone</Text> and tap the purple{' '}
        <Text style={styles.em}>Reset password in LinkUp</Text> button. If you only see plain text with no button, check
        Spam and mark as not junk, or request another link.
      </Text>
      <Button
        title="Return to sign in"
        onPress={() => router.replace('/(auth)/login' as Href)}
        gradient
        fullWidth
        style={styles.cta}
      />
    </DatingAuthShell>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  em: { fontWeight: '800', color: '#FFFFFF' },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cta: { marginTop: spacing.sm },
});
