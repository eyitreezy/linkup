/**
 * Signup — email/password (with verification email), Google OAuth, phone OTP.
 */
import { AuthDivider } from '@/components/auth/AuthDivider';
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { PhoneAuthSection } from '@/components/auth/PhoneAuthSection';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthRedirectUrl, signInWithGoogle, waitForSupabaseSession } from '@/lib/authProviders';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function SignupScreen() {
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  async function onSignup() {
    setErr('');
    if (!isSupabaseConfigured) {
      setErr('Configure Supabase in .env');
      return;
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const redirectTo = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { display_name: displayName.trim() || undefined },
      },
    });
    setLoading(false);
    if (error) {
      const detail = [error.message, (error as { hint?: string }).hint].filter(Boolean).join(' ');
      setErr(detail);
      if (__DEV__) {
        console.warn('[signup] signUp failed', {
          message: error.message,
          code: (error as { code?: string }).code,
        });
      }
      return;
    }
    if (!data.session) {
      setVerificationSent(true);
      return;
    }
    await refreshSession();
    router.replace('/');
  }

  async function onResendVerification() {
    setErr('');
    if (!email.trim()) {
      setErr('Enter your email above first.');
      return;
    }
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    setResendLoading(false);
    if (error) setErr(error.message);
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
      title="Create your profile"
      subtitle="Join LinkUp — discover people nearby and make real connections."
      belowCard={
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.footerPress}>
            <Text style={styles.footerMuted}>Already have an account? </Text>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </Link>
      }
    >
      <GoogleSignInButton
        onPress={onGoogle}
        loading={googleLoading}
        label="Continue with Google"
        elevated
      />

      <AuthDivider label="or sign up with email" />

      {verificationSent ? (
        <View style={styles.verifyCard}>
          <Text style={styles.verifyTitle}>Check your email</Text>
          <Text style={styles.verifyBody}>
            We sent a verification link to <Text style={styles.emailEm}>{email.trim()}</Text>. Open it on this device
            to continue to onboarding.
          </Text>
          <Text style={styles.verifyHint}>
            Add <Text style={styles.mono}>linkup://auth/callback</Text> to Supabase → Auth → Redirect URLs if the link
            doesn’t open the app.
          </Text>
          <Button title="Resend verification email" onPress={onResendVerification} loading={resendLoading} pill />
          <Button
            title="Edit email & try again"
            variant="ghost"
            onPress={() => {
              setVerificationSent(false);
              setErr('');
            }}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Your details</Text>
          <Input
            label="First name or nickname"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we call you?"
            autoComplete="name"
          />
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
            placeholder="At least 6 characters"
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Button title="Create account" onPress={onSignup} loading={loading} pill />
        </View>
      )}

      <AuthDivider label="or phone" />

      <PhoneAuthSection
        variant="signup"
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
  verifyCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
  },
  verifyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  verifyBody: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: spacing.sm },
  emailEm: { fontWeight: '700' },
  verifyHint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  err: { color: colors.danger, marginBottom: spacing.md, marginTop: -spacing.sm, fontSize: 14 },
  footerPress: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingTop: spacing.sm },
  footerMuted: { fontSize: 15, color: colors.textMuted },
  footerLink: { fontSize: 15, fontWeight: '700', color: colors.secondary },
});
