/**
 * Auth stack — unified sign-in, password recovery (no tab bar).
 */
import { useAuth } from '@/contexts/AuthContext';
import { needsOnboarding, ONBOARDING_ROUTE, postAuthHref } from '@/lib/auth/postAuthNavigation';
import { peekRecoveryFlowActive } from '@/lib/auth/pendingAuthUrl';
import { Redirect, Stack, useSegments, type Href } from 'expo-router';

function AuthSessionRedirect() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const inRecoveryFlow = peekRecoveryFlowActive();
  const onResetPassword = segments.includes('reset-password');
  const onForgotSent = segments.includes('forgot-password-sent');
  const onForgotPassword = segments.includes('forgot-password');

  if (inRecoveryFlow) {
    if (!onResetPassword && !onForgotPassword && !onForgotSent) {
      return <Redirect href={'/(auth)/reset-password' as Href} />;
    }
    return null;
  }

  const allowWithSession = onResetPassword || onForgotSent;

  if (allowWithSession) return null;
  if (!session?.user) return null;
  if (loading && !profile) return null;
  if (needsOnboarding(profile)) {
    return <Redirect href={ONBOARDING_ROUTE} />;
  }
  return <Redirect href={postAuthHref(profile)} />;
}

export default function AuthLayout() {
  return (
    <>
      <AuthSessionRedirect />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="forgot-password-sent" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </>
  );
}
