import type { EscrowPattern } from '@/types/database';

/** Who receives funds on release — matches `resolveEscrowParties` payee semantics. */
export function getReleaseRecipientLabel(
  escrowPattern: EscrowPattern | string | null | undefined,
  hostDisplayName: string,
  guestDisplayName: string
): string {
  if (escrowPattern === 'C') {
    return `Funds released to ${hostDisplayName}`;
  }
  return `Funds released to ${guestDisplayName}`;
}

export function getPaymentStatusLabel(
  status: string,
  escrowPattern: EscrowPattern | string | null | undefined,
  hostDisplayName: string,
  guestDisplayName: string
): string {
  switch (status) {
    case 'pending_funding':
      return 'Waiting for payment';
    case 'funded':
    case 'active':
      return 'Held securely in escrow';
    case 'released':
      return getReleaseRecipientLabel(escrowPattern, hostDisplayName, guestDisplayName);
    case 'disputed':
      return 'On hold — dispute';
    case 'refunded':
      return 'Refunded';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
