import type { SupabaseClient } from '@supabase/supabase-js';

export type VerifyEscrowPaymentResult = {
  funded: boolean;
  partial?: boolean;
  fw_status?: string;
  error?: string;
};

/** Server-side Flutterwave verify + direct escrow funding (webhook fallback). */
export async function invokeVerifyEscrowPayment(
  client: SupabaseClient,
  escrowId: string,
  txRef?: string
): Promise<VerifyEscrowPaymentResult> {
  if (txRef) {
    const { data: confirmData, error: confirmErr } = await client.functions.invoke(
      'confirm-escrow-payment',
      { body: { escrow_id: escrowId, tx_ref: txRef } }
    );
    if (!confirmErr && confirmData) {
      const row = confirmData as {
        ok?: boolean;
        status?: string;
        partial?: boolean;
        already?: boolean;
      };
      if (row.status === 'funded' || row.already) {
        return { funded: true, partial: row.partial };
      }
      if (row.ok && row.partial) {
        return { funded: false, partial: true };
      }
    }
  }

  const { data, error } = await client.functions.invoke('verify-flutterwave-payment', {
    body: { escrow_id: escrowId },
  });

  if (error) {
    return { funded: false, error: error.message };
  }

  const row = (data ?? {}) as {
    funded?: boolean;
    partial?: boolean;
    fw_status?: string;
    error?: string;
  };

  return {
    funded: row.funded === true,
    partial: row.partial,
    fw_status: row.fw_status,
    error: row.error,
  };
}
