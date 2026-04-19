/**
 * Google OAuth (Supabase) + phone OTP — used by login / signup screens.
 *
 * - Google: Supabase Dashboard → Authentication → Providers → Google.
 * - Phone SMS: Supabase Dashboard → Authentication → Providers → Phone (Twilio, MessageBird, etc.).
 *   See docs/TWILIO_PHONE_SETUP.md and docs/MESSAGEBIRD_PHONE_SETUP.md.
 * - Email confirmation: `signUp` uses `emailRedirectTo` so the verify link opens the app (`linkup://auth/callback`).
 *   `completeOAuthReturnUrl` also handles `token_hash` + `type` from the confirmation link.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

/**
 * OAuth redirect must match Supabase Auth → URL Configuration (redirect allow list).
 * On real devices, localhost / 127.0.0.1 never points at your dev machine — use app scheme (linkup://…).
 */
export function getAuthRedirectUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ||
    extra?.authRedirectUrl ||
    process.env.EXPO_PUBLIC_URL ||
    '';

  const trimmed = fromEnv.replace(/\/$/, '');

  if (Platform.OS !== 'web' && trimmed && isLocalhostUrl(trimmed)) {
    return Linking.createURL('/auth/callback');
  }
  if (trimmed) return trimmed;
  return Linking.createURL('/auth/callback');
}

/**
 * Opens system browser for Google consent; completes session via PKCE or implicit hash.
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  try {
    const redirectTo = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        // Force Google account chooser instead of silently reusing the last signed-in account.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { error };
    if (!data?.url) return { error: new Error('No OAuth URL returned') };

    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      /* ignore */
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      showInRecents: false,
    });

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: null };
    }
    if (result.type !== 'success' || !result.url) {
      return { error: new Error('Sign-in was not completed') };
    }

    const finish = await completeOAuthReturnUrl(result.url);
    return finish;
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Call from `auth/callback` when the app opens via OAuth deep link (cold start). */
export async function finalizeOAuthFromUrl(url: string): Promise<{ error: Error | null }> {
  return completeOAuthReturnUrl(url);
}

/** True if the deep link likely carried OAuth / email-verification data (vs opening an empty callback URL). */
export function urlLooksLikeAuthRedirect(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  if (u.includes('token_hash=')) return true;
  if (u.includes('code=')) return true;
  if (u.includes('access_token=')) return true;
  if (u.includes('refresh_token=')) return true;
  if (u.includes('error=')) return true;
  return false;
}

async function hasSupabaseSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

/**
 * Polls for a session after OAuth / browser handoff (async storage + client can lag one tick).
 */
export async function waitForSupabaseSession(
  maxAttempts = 12,
  delayMs = 220
): Promise<Session | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return session;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** Types Supabase puts on email confirmation / magic links (token_hash flow). */
const EMAIL_LINK_TOKEN_TYPES = new Set([
  'signup',
  'email',
  'magiclink',
  'invite',
  'recovery',
  'email_change',
]);

/** Email confirmation link: ?token_hash=&type=… (query or hash; type is often `email`, not only `signup`). */
async function tryVerifyEmailLinkFromUrl(trimmed: string): Promise<{ tried: boolean; error: Error | null }> {
  const parsed = Linking.parse(trimmed);
  const q = parsed.queryParams ?? {};
  let token_hash = typeof q.token_hash === 'string' ? q.token_hash : null;
  let type = typeof q.type === 'string' ? q.type : null;
  if (!token_hash || !type) {
    const hashPart = trimmed.split('#')[1];
    if (hashPart) {
      const hp = new URLSearchParams(hashPart);
      token_hash = hp.get('token_hash');
      type = hp.get('type');
    }
  }
  if (!token_hash || !type || !EMAIL_LINK_TOKEN_TYPES.has(type)) {
    return { tried: false, error: null };
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as 'signup' | 'email' | 'magiclink' | 'invite' | 'recovery' | 'email_change',
  });
  if (error && __DEV__) {
    console.warn('[auth] verifyOtp(token_hash):', error.message);
  }
  return { tried: true, error: error ? new Error(error.message) : null };
}

async function completeOAuthReturnUrl(url: string): Promise<{ error: Error | null }> {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return { error: null };
  }

  // Provider / Supabase returned an error in the redirect
  if (trimmed.includes('error=')) {
    const parsed = Linking.parse(trimmed);
    const q = parsed.queryParams ?? {};
    const desc = (q.error_description as string) || (q.error as string) || 'Sign-in was cancelled or failed';
    try {
      return { error: new Error(decodeURIComponent(desc.replace(/\+/g, ' '))) };
    } catch {
      return { error: new Error(String(desc)) };
    }
  }

  // Email signup confirmation / magic link: token_hash + type
  const emailLink = await tryVerifyEmailLinkFromUrl(trimmed);
  if (emailLink.tried) {
    return { error: emailLink.error };
  }

  // PKCE: code in query (?code=) — also handle Linking.parse when query shape differs slightly
  const parsedForCode = Linking.parse(trimmed);
  const queryCode =
    typeof parsedForCode.queryParams?.code === 'string' ? parsedForCode.queryParams.code : undefined;
  if (trimmed.includes('code=') || queryCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(trimmed);
    return { error: error ?? null };
  }

  const hash = trimmed.split('#')[1];
  if (hash) {
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      return { error: error ?? null };
    }
  }

  const parsed = Linking.parse(trimmed);
  const access_token = parsed.queryParams?.access_token as string | undefined;
  const refresh_token = parsed.queryParams?.refresh_token as string | undefined;
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error: error ?? null };
  }

  // Bare callback URL with no tokens — session may appear shortly after WebBrowser handoff
  if (await hasSupabaseSession()) {
    return { error: null };
  }

  return { error: null };
}

/**
 * Normalize to E.164: if input has no leading +, prepend default dial code from env.
 */
export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim().replace(/[\s-]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  const dial =
    process.env.EXPO_PUBLIC_PHONE_DEFAULT_DIAL_CODE ||
    (Constants.expoConfig?.extra as Record<string, string>)?.phoneDefaultDialCode ||
    '+1';
  const prefix = dial.startsWith('+') ? dial : `+${dial}`;
  const digits = trimmed.replace(/^0+/, '');
  return `${prefix}${digits}`;
}

export async function requestPhoneOtp(phoneE164: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
  return { error: error ?? null };
}

export async function verifyPhoneOtp(
  phoneE164: string,
  token: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.verifyOtp({
    phone: phoneE164,
    token: token.trim(),
    type: 'sms',
  });
  return { error: error ?? null };
}
