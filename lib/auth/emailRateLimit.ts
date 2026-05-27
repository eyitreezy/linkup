/** Supabase Auth built-in mail is heavily rate-limited; custom SMTP raises caps. */
const RATE_LIMIT_RE =
  /email rate limit exceeded|over_email_send_rate_limit|rate limit.*email/i;

export function isEmailRateLimitError(message: string): boolean {
  return RATE_LIMIT_RE.test(message);
}

export function emailRateLimitHelpMessage(): string {
  return (
    'Too many auth emails were sent from this project. Wait about an hour, then try again. ' +
    'For development or production, configure custom SMTP in Supabase (Project Settings → Authentication → SMTP) ' +
    'and adjust Auth rate limits — see docs/EMAIL_VERIFICATION_SETUP.md.'
  );
}
