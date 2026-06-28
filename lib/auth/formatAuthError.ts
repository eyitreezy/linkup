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
  if (/invalid.*redirect|redirect.*not allowed|redirect url/i.test(message)) {
    return (
      'This app build uses linkup://auth/callback for email links. ' +
      'Add that URL under Supabase Authentication → URL Configuration → Redirect URLs.'
    );
  }
  if (/smtp|sender|mail delivery|email.*not.*sent|553|550/i.test(message)) {
    return (
      'We could not send the email from the server. ' +
      'Configure Supabase Auth custom SMTP (Resend) and use auth@ or noreply@ on a verified domain — see docs/EMAIL_VERIFICATION_SETUP.md.'
    );
  }
  return message;
}
