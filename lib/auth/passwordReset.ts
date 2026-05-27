import { getAuthRedirectUrl } from '@/lib/authProviders';
import { supabase } from '@/lib/supabase';

export function isRecoveryAuthUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  if (/[?&#]type=recovery\b/i.test(u)) return true;
  if (/type%3Drecovery/i.test(u)) return true;
  if (/\/auth\/v1\/verify/i.test(u) && /[?&]type=recovery/i.test(u)) return true;
  return false;
}

export async function requestPasswordResetEmail(email: string): Promise<{ error: Error | null }> {
  const redirectTo = getAuthRedirectUrl();
  if (__DEV__) {
    console.info('[auth] resetPasswordForEmail redirectTo:', redirectTo);
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function updatePassword(password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
