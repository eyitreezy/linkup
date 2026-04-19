import type { UserVerification } from '@/types/database';

/** Identity verification approved — can create plans, negotiate, use escrow (client + RLS). */
export function isUserVerified(verificationStatus: UserVerification | null | undefined): boolean {
  return verificationStatus === 'verified';
}

/** Show hard gate for restricted flows when the user is not verified. */
export function requiresVerificationGate(verificationStatus: UserVerification | null | undefined): boolean {
  return !isUserVerified(verificationStatus);
}
