/**
 * Ensures auth deep links open /auth/callback before index or login redirect runs.
 */
import { captureAuthLinkIfPresent } from '@/lib/auth/pendingAuthUrl';
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';
import * as Linking from 'expo-linking';
import { useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

const CALLBACK_HREF = '/auth/callback' as Href;

function shouldOpenAuthCallback(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('auth/callback') || urlLooksLikeAuthRedirect(url);
}

export function AuthDeepLinkBootstrap() {
  const router = useRouter();
  const segments = useSegments();
  const handledRef = useRef(false);

  useEffect(() => {
    const routeKey = segments.join('/');
    const onCallback = routeKey.includes('auth/callback') || routeKey === 'auth/callback';

    async function ensureCallbackRoute(url: string | null) {
      if (!url?.trim()) return;
      if (!shouldOpenAuthCallback(url)) return;
      captureAuthLinkIfPresent(url);
      if (onCallback) return;
      if (handledRef.current) return;

      handledRef.current = true;
      router.replace(CALLBACK_HREF);
    }

    void Linking.getInitialURL().then((url) => ensureCallbackRoute(url));

    const sub = Linking.addEventListener('url', ({ url }) => {
      void ensureCallbackRoute(url);
    });

    return () => sub.remove();
  }, [router, segments]);

  return null;
}
