/**
 * Rewrites cold-start deep links so email confirm / OAuth land on /auth/callback
 * (Expo Router otherwise often opens / or /(auth)/login and never exchanges tokens).
 */
import { captureAuthLinkIfPresent } from '@/lib/auth/pendingAuthUrl';
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';

const AUTH_CALLBACK_ROUTE = '/auth/callback';

function pathLooksLikeAuthCallback(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes('auth/callback') ||
    lower.includes('auth%2fcallback') ||
    urlLooksLikeAuthRedirect(path)
  );
}

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (initial && pathLooksLikeAuthCallback(path)) {
      captureAuthLinkIfPresent(path);
      return AUTH_CALLBACK_ROUTE;
    }
    return path;
  } catch {
    return AUTH_CALLBACK_ROUTE;
  }
}
