/**
 * Set new password after recovery deep link (Supabase recovery session).
 */
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { updatePassword } from '@/lib/auth/passwordReset';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function ResetPasswordScreen() {
  const { refreshSession } = useAuth();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session?.user);
      setReady(true);
    })();
  }, []);

  async function onUpdate() {
    setErr('');
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshSession();
    router.replace('/');
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasSession) {
    return (
      <DatingAuthShell showHeroCopy={false} showPagination={false}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.warning} style={styles.warnIcon} />
        <Text style={styles.title}>Link expired</Text>
        <Text style={styles.body}>
          Open the reset link from your email again, or request a new one from the sign-in screen.
        </Text>
        <Button title="Back to sign in" onPress={() => router.replace('/(auth)/login' as Href)} gradient fullWidth />
      </DatingAuthShell>
    );
  }

  return (
    <DatingAuthShell showHeroCopy={false} showPagination={false}>
      <View style={styles.head}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
        <Text style={styles.title}>Create a new password</Text>
        <Text style={styles.sub}>Choose something strong — you&apos;ll use it to sign in to LinkUp.</Text>
      </View>

      <Input
        variant="auth"
        passwordToggle
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordStrengthIndicator password={password} />
      <Input
        variant="auth"
        passwordToggle
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm password"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {err ? <Text style={styles.formErr}>{err}</Text> : null}
      <Button title="Update password" onPress={onUpdate} loading={loading} gradient fullWidth style={styles.cta} />
    </DatingAuthShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0D18' },
  head: { marginBottom: spacing.lg, gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.72)', fontWeight: '500' },
  formErr: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginVertical: spacing.sm },
  cta: { marginTop: spacing.md },
  warnIcon: { alignSelf: 'center', marginBottom: spacing.md },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
