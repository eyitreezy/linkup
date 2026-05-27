import { emailRateLimitHelpMessage, isEmailRateLimitError } from '@/lib/auth/emailRateLimit';

/** User-facing copy for common Supabase Auth failures. */
export function formatAuthError(message: string): string {
  if (isEmailRateLimitError(message)) {
    return emailRateLimitHelpMessage();
  }
  if (/database error saving new user/i.test(message)) {
    return (
      'We could not finish creating your account on the server. ' +
      'The project database needs the latest signup migration applied (see supabase/migrations/20260521120000_fix_signup_handle_new_user.sql).'
    );
  }
  return message;
}
