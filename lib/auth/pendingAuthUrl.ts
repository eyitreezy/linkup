import { isRecoveryAuthUrl } from '@/lib/auth/passwordReset';
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';

let pending: string | null = null;
let pendingRecoveryIntent = false;

function shouldCapture(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  const lower = u.toLowerCase();
  return lower.includes('auth/callback') || urlLooksLikeAuthRedirect(u) || isRecoveryAuthUrl(u);
}

/** Store the full deep link before Expo Router strips query/hash or navigates away. */
export function captureAuthLinkIfPresent(url: string | null | undefined): void {
  const u = url?.trim();
  if (!u) return;
  if (isRecoveryAuthUrl(u)) pendingRecoveryIntent = true;
  if (!shouldCapture(u)) return;
  pending = u;
}

/** True if a captured link was a password recovery flow (survives PKCE redirect stripping `type`). */
export function consumePendingRecoveryIntent(): boolean {
  const v = pendingRecoveryIntent;
  pendingRecoveryIntent = false;
  return v;
}

export function peekPendingAuthUrl(): string | null {
  return pending;
}

/** Returns the captured URL once (subsequent calls return null until a new capture). */
export function consumePendingAuthUrl(): string | null {
  const u = pending;
  pending = null;
  return u;
}
