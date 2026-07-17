import { isUserEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import type { DbEscrowTransaction } from '@/types/database';

export type GuestEscrowRowFields = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'guest_id'
  | 'payer_id'
  | 'status'
  | 'escrow_pattern'
  | 'host_funded_at'
  | 'guest_funded_at'
>;

export function findGuestEscrowForBidder(
  escrows: GuestEscrowRowFields[],
  bidderId: string
): GuestEscrowRowFields | undefined {
  return (
    escrows.find((e) => e.guest_id === bidderId) ??
    escrows.find((e) => e.payer_id === bidderId && e.guest_id != null)
  );
}

export function isGuestEscrowFunded(
  escrow: GuestEscrowRowFields | null | undefined,
  bidderId: string
): boolean {
  if (!escrow) return false;
  return (
    isUserEscrowLegFunded(escrow, bidderId) ||
    escrow.status === 'funded' ||
    escrow.status === 'active' ||
    escrow.status === 'released'
  );
}

export function guestEscrowStatusLabel(
  escrow: GuestEscrowRowFields | null | undefined,
  bidderId: string,
  planPaid: boolean
): string {
  if (!escrow) {
    return planPaid ? 'Awaiting escrow' : 'Confirmed';
  }
  if (isGuestEscrowFunded(escrow, bidderId)) {
    return 'Funded';
  }
  if (escrow.status === 'pending_funding' || planPaid) {
    return 'Awaiting escrow';
  }
  return 'Confirmed';
}
