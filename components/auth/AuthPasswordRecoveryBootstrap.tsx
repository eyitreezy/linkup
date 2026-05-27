/**
 * Routes to reset-password when Supabase emits PASSWORD_RECOVERY (PKCE/hash flows
 * often omit type=recovery on the final linkup:// URL).
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { type Href, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

const RESET_HREF = '/(auth)/reset-password' as Href;

export function AuthPasswordRecoveryBootstrap() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY') return;

      const routeKey = segments.join('/');
      if (routeKey.includes('reset-password')) return;

      router.replace(RESET_HREF);
    });

    return () => subscription.unsubscribe();
  }, [router, segments]);

  return null;
}
