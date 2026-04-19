/**
 * Login — email/password, Google OAuth, phone OTP (dating-app style layout).
 */
import { AuthDivider } from '@/components/auth/AuthDivider';
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { PhoneAuthSection } from '@/components/auth/PhoneAuthSection';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, waitForSupabaseSession } from '@/lib/authProviders';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onLogin() {
    setErr('');
    if (!isSupabaseConfigured) {
      setErr('Configure Supabase in .env');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshSession();
    router.replace('/');
  }

  async function onGoogle() {
    setErr('');
    if (!isSupabaseConfigured) {
      setErr('Configure Supabase in .env');
      return;
    }
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      setErr(error.message);
      return;
    }
    const session = await waitForSupabaseSession();
    setGoogleLoading(false);
    if (!session?.user) {
      setErr('Google sign-in did not complete. Please try again.');
      return;
    }
    await refreshSession();
    router.replace('/');
  }

  return (
    <DatingAuthShell
      title="Welcome back"
      subtitle="Sign in to match, chat, and meet people near you."
      belowCard={
        <Link href="/(auth)/signup" asChild>
          <Pressable style={styles.footerPress}>
            <Text style={styles.footerMuted}>New here? </Text>
            <Text style={styles.footerLink}>Create an account</Text>
          </Pressable>
        </Link>
      }
    >
      <GoogleSignInButton onPress={onGoogle} loading={googleLoading} elevated />

      <AuthDivider label="or use email" />

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Email & password</Text>
        <Input
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button title="Log in" onPress={onLogin} loading={loading} pill />
      </View>

      <AuthDivider label="or phone" />

      <PhoneAuthSection
        variant="login"
        onVerified={async () => {
          await refreshSession();
          router.replace('/');
        }}
        noCard
      />
    </DatingAuthShell>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.sm },
  blockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  err: { color: colors.danger, marginBottom: spacing.md, marginTop: -spacing.sm, fontSize: 14 },
  footerPress: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingTop: spacing.sm },
  footerMuted: { fontSize: 15, color: colors.textMuted },
  footerLink: { fontSize: 15, fontWeight: '700', color: colors.secondary },
});
