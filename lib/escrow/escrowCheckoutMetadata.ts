import type { DbEscrowTransaction } from '@/types/database';

export function escrowCheckoutReference(
  escrow: Pick<DbEscrowTransaction, 'metadata'> | null | undefined
): string | null {
  if (!escrow?.metadata || typeof escrow.metadata !== 'object' || Array.isArray(escrow.metadata)) {
    return null;
  }
  const ref = (escrow.metadata as Record<string, unknown>).checkout_reference;
  return typeof ref === 'string' && ref.trim() ? ref.trim() : null;
}

export function escrowPaymentInitiated(
  escrow: Pick<DbEscrowTransaction, 'metadata'> | null | undefined
): boolean {
  if (!escrow?.metadata || typeof escrow.metadata !== 'object' || Array.isArray(escrow.metadata)) {
    return false;
  }
  const m = escrow.metadata as Record<string, unknown>;
  return typeof m.payment_initiated_at === 'string' || typeof m.checkout_reference === 'string';
}

/** User completed Flutterwave checkout and returned to the app — awaiting escrow fulfillment. */
export function escrowCheckoutReturned(
  escrow: Pick<DbEscrowTransaction, 'metadata'> | null | undefined
): boolean {
  if (!escrow?.metadata || typeof escrow.metadata !== 'object' || Array.isArray(escrow.metadata)) {
    return false;
  }
  const m = escrow.metadata as Record<string, unknown>;
  return typeof m.checkout_returned_at === 'string';
}

/** Payment submitted at Flutterwave; escrow confirmation may still be in flight. */
export function escrowAwaitingFulfillment(
  escrow: Pick<DbEscrowTransaction, 'metadata'> | null | undefined
): boolean {
  return escrowPaymentInitiated(escrow) && escrowCheckoutReturned(escrow);
}

export function escrowCheckoutInitiator(
  escrow: Pick<DbEscrowTransaction, 'metadata'> | null | undefined
): string | null {
  if (!escrow?.metadata || typeof escrow.metadata !== 'object' || Array.isArray(escrow.metadata)) {
    return null;
  }
  const by = (escrow.metadata as Record<string, unknown>).checkout_initiated_by;
  return typeof by === 'string' && by.trim() ? by.trim() : null;
}
