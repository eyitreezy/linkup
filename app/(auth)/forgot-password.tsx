/**
 * Forgot password — request reset email.
 */
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing } from '@/constants/theme';
import { formatAuthError } from '@/lib/auth/formatAuthError';
import { requestPasswordResetEmail } from '@/lib/auth/passwordReset';
import { useEmailSendCooldown } from '@/lib/auth/useEmailSendCooldown';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const sendCooldown = useEmailSendCooldown(60);

  async function onSend() {
    setErr('');
    if (!email.trim()) {
      setErr('Enter the email you used for LinkUp.');
      return;
    }
    if (!sendCooldown.canSend) {
      setErr(`Please wait ${sendCooldown.remaining}s before sending again.`);
      return;
    }
    if (!isSupabaseConfigured) {
      setErr('Configure Supabase in .env');
      return;
    }
    setLoading(true);
    const { error } = await requestPasswordResetEmail(email);
    setLoading(false);
    if (error) {
      setErr(formatAuthError(error.message));
      return;
    }
    sendCooldown.startCooldown();
    router.push({ pathname: '/(auth)/forgot-password-sent', params: { email: email.trim() } });
  }

  return (
    <DatingAuthShell showHeroCopy={false} showPagination={false}>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={10}>
        <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
        <Text style={styles.backTxt}>Back</Text>
      </Pressable>

      <View style={styles.head}>
        <Ionicons name="key-outline" size={28} color={colors.secondary} />
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.sub}>
          Enter your email and we&apos;ll send a secure link. The link opens LinkUp so you can choose a new password.
        </Text>
      </View>

      <Input
        variant="auth"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
      />
      {err ? <Text style={styles.formErr}>{err}</Text> : null}
      <Button
        title={sendCooldown.remaining > 0 ? `Send again in ${sendCooldown.remaining}s` : 'Send reset link'}
        onPress={onSend}
        loading={loading}
        disabled={!sendCooldown.canSend || loading}
        gradient
        fullWidth
        style={styles.cta}
      />
    </DatingAuthShell>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backTxt: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  head: { marginBottom: spacing.lg, gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.72)', fontWeight: '500' },
  formErr: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  cta: { marginTop: spacing.md },
});
