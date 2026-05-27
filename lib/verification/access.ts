import type { UserVerification } from '@/types/database';

/** Identity verification approved — can create plans, negotiate, use escrow (client + RLS). */
export function isUserVerified(verificationStatus: UserVerification | null | undefined): boolean {
  return verificationStatus === 'verified';
}

export type VerificationGateOpts = {
  isAdmin?: boolean;
  /** Denormalized verified host flag — kept in sync with users.verification_status. */
  verifiedBadge?: boolean | null;
};

/**
 * When `opts` is passed, align with `public.user_may_create_plan` (admin, badge, verified).
 */
export function requiresVerificationGate(
  verificationStatus: UserVerification | null | undefined,
  opts?: VerificationGateOpts
): boolean {
  if (opts?.isAdmin) return false;
  if (opts?.verifiedBadge) return false;
  return !isUserVerified(verificationStatus);
}
