import { AuthScreen } from '@/components/auth/AuthScreen';
import { Redirect } from 'expo-router';

/** Default auth entry — send to login route for stable deep links. */
export default function AuthIndexScreen() {
  return <Redirect href="/(auth)/login" />;
}

export { AuthScreen };
