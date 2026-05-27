import {
  finalizeOAuthFromUrl,
  urlLooksLikeAuthRedirect,
  waitForSupabaseSession,
} from '@/lib/authProviders';
import { isRecoveryAuthUrl } from '@/lib/auth/passwordReset';
import { ONBOARDING_ROUTE, resolvePostAuthHref } from '@/lib/auth/postAuthNavigation';
import { consumePendingAuthUrl, consumePendingRecoveryIntent } from '@/lib/auth/pendingAuthUrl';
import { getSessionRecoveringStale } from '@/lib/auth/sessionRecovery';
import type { Session } from '@supabase/supabase-js';
import type { Href, Router } from 'expo-router';

export type PostAuthCallbackResult = 'success' | 'failed' | 'no_url';

export { ONBOARDING_ROUTE };

/** Best available deep link URL (captured before router navigation). */
export function resolveAuthCallbackUrl(fallback?: string | null): string {
  const pending = consumePendingAuthUrl();
  const fb = fallback?.trim() ?? '';
  return pending || fb;
}

/**
 * Finish email confirm / OAuth deep link: exchange tokens, refresh session, route to onboarding (step 1) or tabs.
 */
export async function completePostAuthFromDeepLink(opts: {
  url: string | null | undefined;
  refreshSession: (options?: { quiet?: boolean }) => Promise<Session | null>;
  router: Pick<Router, 'replace'>;
}): Promise<PostAuthCallbackResult> {
  const trimmed = resolveAuthCallbackUrl(opts.url) || opts.url?.trim() || '';
  const recovery = isRecoveryAuthUrl(trimmed) || consumePendingRecoveryIntent();
  const expectAuth = trimmed ? urlLooksLikeAuthRedirect(trimmed) : false;

  if (!trimmed) {
    const { session: existing } = await getSessionRecoveringStale();
    if (!existing?.user) return 'no_url';
  }

  if (trimmed) {
    const { error } = await finalizeOAuthFromUrl(trimmed);
    if (error && __DEV__) {
      console.warn('[completePostAuth]', error.message, trimmed.slice(0, 120));
    }
  }

  const session = await waitForSupabaseSession(expectAuth ? 80 : 30, 150);
  if (!session?.user) {
    if (expectAuth && trimmed) {
      const { error } = await finalizeOAuthFromUrl(trimmed);
      if (!error) {
        const retry = await waitForSupabaseSession(40, 150);
        if (retry?.user) {
          await opts.refreshSession({ quiet: true });
          const href = await resolvePostAuthHref(retry.user.id);
          opts.router.replace(href);
          void opts.refreshSession();
          return 'success';
        }
      }
    }
    return expectAuth ? 'failed' : 'no_url';
  }

  await opts.refreshSession({ quiet: true });

  const { session: confirmed } = await getSessionRecoveringStale();

  if (!confirmed?.user) {
    return 'failed';
  }

  if (recovery) {
    opts.router.replace('/(auth)/reset-password' as Href);
    return 'success';
  }

  const href = await resolvePostAuthHref(confirmed.user.id);
  opts.router.replace(href);
  void opts.refreshSession();
  return 'success';
}
