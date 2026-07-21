/**
 * Rewrites cold-start deep links so email confirm / OAuth land on /auth/callback
 * (Expo Router otherwise often opens / or /(auth)/login and never exchanges tokens).
 */
import { captureAuthLinkIfPresent } from '@/lib/auth/pendingAuthUrl';
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';
import { parsePlanIdFromUrl } from '@/lib/plans/planShareUrl';

const AUTH_CALLBACK_ROUTE = '/auth/callback';

function pathLooksLikeAuthCallback(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes('auth/callback') ||
    lower.includes('auth%2fcallback') ||
    urlLooksLikeAuthRedirect(path)
  );
}

function pathToPlanDetailRoute(path: string): string | null {
  const planId = parsePlanIdFromUrl(path);
  if (!planId) return null;
  return `/plan/${planId}`;
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
    if (initial) {
      const planRoute = pathToPlanDetailRoute(path);
      if (planRoute) return planRoute;
    }
    return path;
  } catch {
    return AUTH_CALLBACK_ROUTE;
  }
}
