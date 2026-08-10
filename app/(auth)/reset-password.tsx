/**
 * Set new password after recovery deep link (Supabase recovery session).
 */
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { PasswordRequirementFeedback } from '@/components/auth/PasswordRequirementFeedback';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { updatePassword } from '@/lib/auth/passwordReset';
import { clearRecoveryFlowActive, peekRecoveryFlowActive } from '@/lib/auth/pendingAuthUrl';
import { formatRecoveryAuthError, PASSWORD_RESET_EXPIRED_MESSAGE } from '@/lib/auth/recoveryErrors';
import { getPasswordRequirementErrors } from '@/lib/auth/passwordStrength';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const SESSION_POLL_MS = 200;

async function waitForRecoverySession(maxAttempts: number): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return true;
    if (!peekRecoveryFlowActive() && i >= 4) return false;
    await new Promise((r) => setTimeout(r, SESSION_POLL_MS));
  }
  return false;
}

export default function ResetPasswordScreen() {
  const { refreshSession } = useAuth();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const maxAttempts = peekRecoveryFlowActive() ? 50 : 15;
      const ok = await waitForRecoverySession(maxAttempts);
      if (cancelled) return;
      setHasSession(ok);
      setReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setHasSession(!!session?.user);
        setReady(true);
        if (event === 'PASSWORD_RECOVERY') setErr('');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onUpdate() {
    setErr('');
    const requirementErrors = getPasswordRequirementErrors(password);
    if (requirementErrors.length > 0) {
      setShowRequirements(true);
      setErr(requirementErrors.join('\n'));
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
      setErr(formatRecoveryAuthError(error.message));
      return;
    }
    clearRecoveryFlowActive();
    await supabase.auth.signOut({ scope: 'local' });
    await refreshSession();
    setSuccess(true);
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingHint}>Opening your reset link…</Text>
      </View>
    );
  }

  if (success) {
    return (
      <DatingAuthShell showHeroCopy={false} showPagination={false}>
        <Ionicons name="checkmark-circle-outline" size={44} color={colors.primary} style={styles.successIcon} />
        <Text style={styles.title}>Password updated</Text>
        <Text style={styles.body}>Your new password is saved. Sign in with it to continue.</Text>
        <Button
          title="Go to sign in"
          onPress={() => router.replace('/(auth)/login' as Href)}
          gradient
          fullWidth
        />
      </DatingAuthShell>
    );
  }

  if (!hasSession) {
    return (
      <DatingAuthShell showHeroCopy={false} showPagination={false}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.warning} style={styles.warnIcon} />
        <Text style={styles.title}>Reset link expired or invalid</Text>
        <Text style={styles.body}>{PASSWORD_RESET_EXPIRED_MESSAGE}</Text>
        <Button
          title="Request a new reset link"
          onPress={() => router.replace('/(auth)/forgot-password' as Href)}
          gradient
          fullWidth
        />
        <Button
          title="Back to sign in"
          onPress={() => router.replace('/(auth)/login' as Href)}
          variant="ghost"
          fullWidth
          style={styles.secondaryBtn}
        />
      </DatingAuthShell>
    );
  }

  return (
    <DatingAuthShell showHeroCopy={false} showPagination={false}>
      <View style={styles.head}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
        <Text style={styles.title}>Create a new password</Text>
        <Text style={styles.sub}>Choose something strong. You&apos;ll use it to sign in to LinkUp.</Text>
      </View>

      <Input
        variant="auth"
        passwordToggle
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (showRequirements || value.length > 0) setShowRequirements(true);
          if (showRequirements) {
            const remaining = getPasswordRequirementErrors(value);
            setErr((prev) => {
              if (!prev || !prev.includes('Password must')) return prev;
              return remaining.length > 0 ? remaining.join('\n') : '';
            });
          }
        }}
        placeholder="New password"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordStrengthIndicator password={password} />
      <PasswordRequirementFeedback
        password={password}
        visible={showRequirements || password.length > 0}
      />
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
  loadingHint: {
    marginTop: spacing.md,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: fonts.regular,
  },
  head: { marginBottom: spacing.lg, gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '900',
    fontFamily: fonts.bold, color: '#FFFFFF', letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.72)', fontWeight: '500', fontFamily: fonts.regular, },
  formErr: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: spacing.sm,
    fontFamily: fonts.regular,
    lineHeight: 19,
  },
  cta: { marginTop: spacing.md },
  secondaryBtn: { marginTop: spacing.sm },
  warnIcon: { alignSelf: 'center', marginBottom: spacing.md },
  successIcon: { alignSelf: 'center', marginBottom: spacing.md },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
