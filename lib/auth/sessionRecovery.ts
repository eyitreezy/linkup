import { peekPendingAuthUrl } from '@/lib/auth/pendingAuthUrl';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Stale or revoked session in AsyncStorage — common after reinstall, email confirm, or server reset. */
export function isStaleAuthSessionError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error ?? '');
  return /invalid refresh token|refresh token not found|refresh_token_not_found|session_not_found/i.test(
    msg
  );
}

/** Remove broken persisted tokens so the user can sign in or complete email confirm again. */
export async function clearStaleAuthSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* ignore — storage may already be empty */
  }
}

/**
 * Read session; if refresh token is invalid, wipe local auth and return null.
 */
export async function getSessionRecoveringStale(): Promise<{
  session: Session | null;
  recoveredFromStale: boolean;
}> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && isStaleAuthSessionError(error)) {
      // Keep PKCE verifier + storage until /auth/callback exchanges the email-confirm code.
      if (peekPendingAuthUrl()) {
        return { session: null, recoveredFromStale: false };
      }
      await clearStaleAuthSession();
      return { session: null, recoveredFromStale: true };
    }
    if (error) {
      if (__DEV__) console.warn('[Auth] getSession:', error.message);
      return { session: null, recoveredFromStale: false };
    }
    return { session: data.session ?? null, recoveredFromStale: false };
  } catch (e) {
    if (isStaleAuthSessionError(e)) {
      if (peekPendingAuthUrl()) {
        return { session: null, recoveredFromStale: false };
      }
      await clearStaleAuthSession();
      return { session: null, recoveredFromStale: true };
    }
    if (__DEV__) console.warn('[Auth] getSession threw:', e instanceof Error ? e.message : e);
    return { session: null, recoveredFromStale: false };
  }
}
