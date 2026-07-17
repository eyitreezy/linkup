import type { SupabaseClient } from '@supabase/supabase-js';
import {
  settleEscrowCheckout,
  type SettleEscrowCheckoutResult,
} from '@/lib/escrow/confirmEscrowPaymentAfterCheckout';
import {
  escrowCheckoutInitiator,
  escrowCheckoutReference,
  escrowAwaitingFulfillment,
  escrowCheckoutReturned,
  escrowPaymentInitiated,
} from '@/lib/escrow/escrowCheckoutMetadata';
import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import type { DbEscrowTransaction } from '@/types/database';

const inFlightKeys = new Set<string>();

type ResumeResult = {
  ran: boolean;
  result?: SettleEscrowCheckoutResult;
};

async function pollEscrowFunded(
  client: SupabaseClient,
  escrowId: string,
  opts?: { attempts?: number; intervalMs?: number }
): Promise<SettleEscrowCheckoutResult> {
  const attempts = opts?.attempts ?? 12;
  const intervalMs = opts?.intervalMs ?? 1500;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    const { data: esc } = await client
      .from('escrow_transactions')
      .select('status, host_funded_at, guest_funded_at, escrow_pattern')
      .eq('id', escrowId)
      .maybeSingle();
    if (!esc) {
      return { ok: false, funded: false, error: 'Escrow not found.' };
    }
    if (esc.status === 'funded') {
      return { ok: true, funded: true };
    }
    if (esc.escrow_pattern === 'B') {
      const hostDone = !!esc.host_funded_at;
      const guestDone = !!esc.guest_funded_at;
      if (hostDone || guestDone) {
        return { ok: true, funded: false, partial: true };
      }
    }
  }

  return {
    ok: false,
    funded: false,
    pending: true,
  };
}

function shouldConfirmCheckout(
  escrow: Pick<DbEscrowTransaction, 'metadata' | 'escrow_pattern' | 'status' | 'payer_id' | 'host_id' | 'guest_id' | 'amount_cents' | 'host_share_cents' | 'guest_share_cents' | 'host_funded_at' | 'guest_funded_at'>,
  currentUserId: string
): boolean {
  const initiator = escrowCheckoutInitiator(escrow);
  if (initiator) {
    return initiator === currentUserId;
  }
  return getEscrowFundingUiState(escrow, currentUserId).canFund;
}

/**
 * After Flutterwave checkout, verify tx_ref server-side and apply funding (webhook fallback).
 * Only the user who opened checkout calls confirm; counterparty polls DB for webhook updates.
 */
export async function resumeEscrowSettlementIfNeeded(
  client: SupabaseClient,
  escrow: Pick<
    DbEscrowTransaction,
    | 'id'
    | 'status'
    | 'metadata'
    | 'escrow_pattern'
    | 'payer_id'
    | 'host_id'
    | 'guest_id'
    | 'amount_cents'
    | 'host_share_cents'
    | 'guest_share_cents'
    | 'host_funded_at'
    | 'guest_funded_at'
  >,
  currentUserId: string,
  opts?: { force?: boolean }
): Promise<ResumeResult> {
  if (escrow.status !== 'pending_funding') {
    return { ran: false };
  }
  if (!escrowAwaitingFulfillment(escrow)) {
    return { ran: false };
  }
  const txRef = escrowCheckoutReference(escrow);
  if (!txRef) {
    return { ran: false };
  }

  const key = `${escrow.id}:${txRef}:${currentUserId}`;
  if (!opts?.force && inFlightKeys.has(key)) {
    return { ran: false };
  }
  inFlightKeys.add(key);

  try {
    if (!shouldConfirmCheckout(escrow, currentUserId)) {
      const result = await pollEscrowFunded(client, escrow.id);
      return { ran: true, result };
    }

    const result = await settleEscrowCheckout(client, escrow.id, txRef, {
      confirmAttempts: opts?.force ? 6 : 5,
      pollAttempts: 24,
      pollIntervalMs: 1500,
    });
    return { ran: true, result };
  } finally {
    inFlightKeys.delete(key);
  }
}
