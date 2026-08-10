export const PASSWORD_RESET_EXPIRED_MESSAGE =
  'This reset link has expired or is no longer valid. Request a new password-reset email and open the link on this phone with LinkUp installed.';

function isPkceVerifierError(message: string): boolean {
  return /pkce|code verifier/i.test(message);
}

/** Map Supabase recovery errors to safe, user-facing copy. */
export function formatRecoveryAuthError(message: string): string {
  if (isPkceVerifierError(message)) {
    return PASSWORD_RESET_EXPIRED_MESSAGE;
  }
  if (/expired|invalid|already been used|otp|token|session/i.test(message)) {
    return PASSWORD_RESET_EXPIRED_MESSAGE;
  }
  return message;
}
