/**
 * Trust-based messaging caps — messaging is not hard-gated by KYC; unverified users get daily send limits.
 */
import type { UserVerification } from '@/types/database';

export const UNVERIFIED_DAILY_MESSAGE_CAP = 8;

export function isMessagingFullyVerified(verificationStatus: UserVerification | null | undefined): boolean {
  return verificationStatus === 'verified';
}

export function startOfUtcDayIso(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return x.toISOString();
}
