import { AuthScreen } from '@/components/auth/AuthScreen';
import { isSafeInAppRedirect } from '@/lib/auth/pendingAuthRedirect';
import { useLocalSearchParams } from 'expo-router';

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const redirectTo = isSafeInAppRedirect(typeof redirect === 'string' ? redirect : undefined)
    ? redirect
    : undefined;
  return <AuthScreen initialMode="login" redirectTo={redirectTo} />;
}
