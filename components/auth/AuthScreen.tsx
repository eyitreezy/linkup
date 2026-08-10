/**
 * Unified login / signup — shared hero, glass card, mode toggle.
 */
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthModeToggle, type AuthMode } from '@/components/auth/AuthModeToggle';
import { useAuthSheetScroll } from '@/components/auth/AuthSheetScrollContext';
import { DatingAuthShell } from '@/components/auth/DatingAuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { PasswordRequirementFeedback } from '@/components/auth/PasswordRequirementFeedback';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthRedirectUrl, signInWithGoogle, waitForSupabaseSession } from '@/lib/authProviders';
import { formatAuthError } from '@/lib/auth/formatAuthError';
import { useEmailSendCooldown } from '@/lib/auth/useEmailSendCooldown';
import { resolvePostAuthHref } from '@/lib/auth/postAuthNavigation';
import { getPasswordRequirementErrors } from '@/lib/auth/passwordStrength';
import {
  consumePendingSignupPrivacyConsent,
  markPendingSignupPrivacyConsent,
} from '@/lib/privacy/pendingSignupConsentStorage';
import { recordPrivacyConsent } from '@/lib/privacy/recordPrivacyConsent';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  initialMode?: AuthMode;
};

type SignupPasswordFieldProps = {
  password: string;
  onChangePassword: (value: string) => void;
  showRequirements: boolean;
};

/** Must render inside DatingAuthShell so keyboard scroll context is available. */
function SignupPasswordField({ password, onChangePassword, showRequirements }: SignupPasswordFieldProps) {
  const groupRef = useRef<View>(null);
  const authSheetScroll = useAuthSheetScroll();

  return (
    <View
      ref={groupRef}
      collapsable={false}
      onLayout={() => {
        if (authSheetScroll?.keyboardOpen && groupRef.current) {
          authSheetScroll.scrollFieldIntoView(groupRef);
        }
      }}
    >
      <Input
        variant="auth"
        passwordToggle
        scrollAnchorRef={groupRef}
        value={password}
        onChangeText={onChangePassword}
        placeholder="Password (min. 6 characters, 1 uppercase, 1 number)"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordStrengthIndicator password={password} />
      <PasswordRequirementFeedback
        password={password}
        visible={showRequirements || password.length > 0}
      />
    </View>
  );
}

export function AuthScreen({ initialMode = 'login' }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const { session, profile, loading: authLoading, refreshSession } = useAuth();
  const [pendingNav, setPendingNav] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const resendCooldown = useEmailSendCooldown(60);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  const switchMode = useCallback(
    (next: AuthMode) => {
      if (next === mode) return;
      setMode(next);
      setErr('');
      setVerificationSent(false);
      setPrivacyConsentChecked(false);
      setShowConsentError(false);
      setShowPasswordRequirements(false);
    },
    [mode]
  );

  /** Navigate only after AuthContext has session (fresh profile fetch → onboarding vs tabs). */
  useEffect(() => {
    if (!pendingNav) return;
    if (authLoading) return;
    if (!session?.user) {
      setPendingNav(false);
      setErr('Could not start your session. Please try again.');
      setLoading(false);
      setGoogleLoading(false);
      return;
    }
    const userId = session.user.id;
    void (async () => {
      const href = await resolvePostAuthHref(userId);
      setPendingNav(false);
      setLoading(false);
      setGoogleLoading(false);
      router.replace(href);
    })();
  }, [pendingNav, authLoading, session?.user?.id]);

  async function completeAuthAfterSignIn() {
    await refreshSession({ quiet: true });
    const confirmed = await waitForSupabaseSession(30, 200);
    if (!confirmed?.user) {
      throw new Error('Could not establish your session. Please try again.');
    }
    setPendingNav(true);
  }

  async function onLogin() {
    setErr('');
    if (!isSupabaseConfigured) {
      setErr(
        'Supabase is not configured in this build. Local dev: add keys to .env. EAS: run npm run eas:env:push:preview and rebuild.'
      );
      return;
    }
    if (!email.trim()) {
      setErr('Enter your email.');
      return;
    }
    if (!password) {
      setErr('Enter your password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErr(formatAuthError(error.message));
        setLoading(false);
        return;
      }
      if (!data.session) {
        setErr('Sign-in succeeded but no session was returned. Please try again.');
        setLoading(false);
        return;
      }
      await completeAuthAfterSignIn();
    } catch (e) {
      setPendingNav(false);
      setErr(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  async function onSignup() {
    setErr('');
    if (!isSupabaseConfigured) {
      setErr(
        'Supabase is not configured in this build. Local dev: add keys to .env. EAS: run npm run eas:env:push:preview and rebuild.'
      );
      return;
    }
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErr('Enter your name.');
      return;
    }
    if (!email.trim()) {
      setErr('Enter your email.');
      return;
    }
    const requirementErrors = getPasswordRequirementErrors(password);
    if (requirementErrors.length > 0) {
      setShowPasswordRequirements(true);
      setErr(requirementErrors.join('\n'));
      return;
    }
    if (!privacyConsentChecked) {
      setShowConsentError(true);
      return;
    }
    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { display_name: trimmedName },
        },
      });
      if (error) {
        const raw = [error.message, (error as { hint?: string }).hint].filter(Boolean).join(' ');
        setErr(formatAuthError(raw));
        setLoading(false);
        return;
      }
      if (!data.session) {
        await markPendingSignupPrivacyConsent();
        setVerificationSent(true);
        resendCooldown.startCooldown();
        setLoading(false);
        return;
      }
      if (data.user) {
        await recordPrivacyConsent(data.user.id, 'signup');
      }
      await completeAuthAfterSignIn();
    } catch (e) {
      setPendingNav(false);
      setErr(e instanceof Error ? e.message : 'Sign-up failed. Please try again.');
      setLoading(false);
    }
  }

  async function onResendVerification() {
    setErr('');
    if (!email.trim()) {
      setErr('Enter your email first.');
      return;
    }
    if (!resendCooldown.canSend) {
      setErr(`Please wait ${resendCooldown.remaining}s before resending.`);
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getAuthRedirectUrl() },
      });
      if (error) setErr(formatAuthError(error.message));
      else resendCooldown.startCooldown();
    } finally {
      setResendLoading(false);
    }
  }

  async function onGoogle() {
    setErr('');
    if (!isSupabaseConfigured) {
      setErr(
        'Supabase is not configured in this build. Local dev: add keys to .env. EAS: run npm run eas:env:push:preview and rebuild.'
      );
      return;
    }
    if (mode === 'signup' && !privacyConsentChecked) {
      setShowConsentError(true);
      return;
    }
    setGoogleLoading(true);
    try {
      if (mode === 'signup') {
        await markPendingSignupPrivacyConsent();
      }
      const { error } = await signInWithGoogle();
      if (error) {
        if (mode === 'signup') await consumePendingSignupPrivacyConsent();
        setErr(error.message);
        setGoogleLoading(false);
        return;
      }
      const oauthSession = await waitForSupabaseSession(40, 200);
      if (!oauthSession?.user) {
        if (mode === 'signup') await consumePendingSignupPrivacyConsent();
        setErr('Google sign-in did not complete. Please try again.');
        setGoogleLoading(false);
        return;
      }
      if (mode === 'signup') {
        await recordPrivacyConsent(oauthSession.user.id, 'signup');
        await consumePendingSignupPrivacyConsent();
      }
      await completeAuthAfterSignIn();
    } catch (e) {
      if (mode === 'signup') await consumePendingSignupPrivacyConsent();
      setPendingNav(false);
      setErr(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  }

  const showLoginForm = mode === 'login';
  const showSignupForm = mode === 'signup' && !verificationSent;
  const showVerifyCard = mode === 'signup' && verificationSent;

  return (
    <DatingAuthShell>
      <AuthModeToggle mode={mode} onChange={switchMode} />

      <GoogleSignInButton onPress={() => void onGoogle()} loading={googleLoading} elevated fullWidth />

      {showConsentError && showSignupForm ? (
        <Text style={styles.consentErrorText}>Please accept the Privacy Policy to continue</Text>
      ) : null}

      <AuthDivider
        tone="glass"
        label={mode === 'login' ? 'Or continue with email' : 'Or sign up with email'}
      />

      {showLoginForm ? (
        <MotiView
          key="login-form"
          from={{ opacity: 0, translateX: -8 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 220 }}
        >
          <View style={styles.fieldStack}>
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
            <View>
              <Input
                variant="auth"
                passwordToggle
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                autoComplete="password"
                textContentType="password"
              />
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password' as Href)}
                style={styles.forgotRow}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
              >
                <Text style={styles.forgotTxt}>Forgot password?</Text>
              </Pressable>
            </View>
            {err ? <Text style={styles.formErr}>{err}</Text> : null}
            <Button
              title="Log in"
              onPress={() => void onLogin()}
              loading={loading}
              gradient
              fullWidth
            />
          </View>
        </MotiView>
      ) : null}

      {showVerifyCard ? (
        <MotiView
          key="verify"
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 220 }}
          style={styles.verifyCard}
        >
          <Ionicons name="mail-open-outline" size={32} color={colors.secondary} style={styles.verifyIcon} />
          <Text style={styles.verifyTitle}>Check your email</Text>
          <Text style={styles.verifyBody}>
            We sent a verification link to <Text style={styles.emailEm}>{email.trim()}</Text>. Open it on this
            device to continue.
          </Text>
          {err ? <Text style={styles.formErr}>{err}</Text> : null}
          <Button
            title={
              resendCooldown.remaining > 0
                ? `Resend in ${resendCooldown.remaining}s`
                : 'Resend verification email'
            }
            onPress={() => void onResendVerification()}
            loading={resendLoading}
            disabled={!resendCooldown.canSend || resendLoading}
            gradient
            fullWidth
          />
          <Button
            title="Edit email"
            variant="ghost"
            onPress={() => {
              setVerificationSent(false);
              setErr('');
            }}
            fullWidth
            style={styles.ghostBtn}
            textStyle={styles.ghostTxt}
          />
        </MotiView>
      ) : null}

      {showSignupForm ? (
        <MotiView
          key="signup-form"
          from={{ opacity: 0, translateX: 8 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 220 }}
        >
          <View style={styles.fieldStack}>
            <Input
              variant="auth"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
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
            <SignupPasswordField
              password={password}
              onChangePassword={(value) => {
                setPassword(value);
                if (showPasswordRequirements || value.length > 0) {
                  setShowPasswordRequirements(true);
                }
                if (showPasswordRequirements) {
                  const remaining = getPasswordRequirementErrors(value);
                  setErr((prev) => {
                    if (!prev || !prev.includes('Password must')) return prev;
                    return remaining.length > 0 ? remaining.join('\n') : '';
                  });
                }
              }}
              showRequirements={showPasswordRequirements}
            />
            {err ? <Text style={styles.formErr}>{err}</Text> : null}
            <View style={styles.consentRow}>
              <Pressable
                onPress={() => {
                  setPrivacyConsentChecked((checked) => !checked);
                  setShowConsentError(false);
                }}
                style={styles.checkboxTouchable}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyConsentChecked }}
                accessibilityLabel="Agree to Privacy Policy"
              >
                <View style={[styles.checkbox, privacyConsentChecked && styles.checkboxChecked]}>
                  {privacyConsentChecked ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>
              <Text style={styles.consentText}>
                I agree to the{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => router.push('/legal/privacy-policy' as Href)}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
            {showConsentError ? (
              <Text style={styles.consentErrorText}>Please accept the Privacy Policy to continue</Text>
            ) : null}
            <Button
              title="Create account"
              onPress={() => void onSignup()}
              loading={loading}
              gradient
              fullWidth
            />
          </View>
        </MotiView>
      ) : null}

      <Text style={styles.trustLine}>
        <Ionicons name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.5)" /> Your data stays
        private. We never sell your information.
      </Text>
    </DatingAuthShell>
  );
}

const styles = StyleSheet.create({
  fieldStack: { gap: 0 },
  forgotRow: { alignSelf: 'flex-end', marginTop: 8, marginBottom: spacing.sm },
  forgotTxt: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: -0.1,
  },
  formErr: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: spacing.md,
    fontWeight: '600',
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  verifyCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  verifyIcon: { alignSelf: 'center', marginBottom: spacing.sm },
  verifyTitle: {
    fontSize: 19,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  verifyBody: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 23,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emailEm: { fontWeight: '800',
    fontFamily: fonts.bold, color: '#FFFFFF' },
  ghostBtn: { marginTop: spacing.sm, borderColor: 'rgba(255,255,255,0.35)' },
  ghostTxt: { color: 'rgba(255,255,255,0.9)' },
  trustLine: {
    marginTop: spacing.lg,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontWeight: '500',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkboxTouchable: { paddingTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.88)',
  },
  consentLink: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: fonts.bold,
    textDecorationLine: 'underline',
  },
  consentErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm,
    fontWeight: '600',
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
});
