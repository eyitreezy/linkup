import type { SupabaseClient } from '@supabase/supabase-js';
import { getInvokeErrorMessage } from '@/lib/flutterwave/parsePaymentLink';
import { isSupabaseConfigured } from '@/lib/supabase';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SettleEscrowCheckoutResult = {
  ok: boolean;
  funded: boolean;
  partial?: boolean;
  pending?: boolean;
  error?: string;
};

async function invokeConfirm(
  client: SupabaseClient,
  escrowId: string,
  txRef: string
): Promise<{ status?: string; partial?: boolean; error?: string }> {
  const { data, error } = await client.functions.invoke('confirm-escrow-payment', {
    body: { escrow_id: escrowId, tx_ref: txRef },
  });

  if (!error) {
    const row = data as { status?: string; partial?: boolean } | null;
    return { status: row?.status, partial: row?.partial };
  }

  const msg = await getInvokeErrorMessage(error, data);
  if (/not confirmed|payment_not_confirmed/i.test(msg)) {
    return { error: 'pending' };
  }
  return { error: msg };
}

async function readEscrowStatus(client: SupabaseClient, escrowId: string) {
  const { data: esc } = await client
    .from('escrow_transactions')
    .select('status, host_funded_at, guest_funded_at, escrow_pattern')
    .eq('id', escrowId)
    .maybeSingle();
  return esc;
}

/** Verify tx_ref with Flutterwave (server) and poll until escrow is funded. */
export async function settleEscrowCheckout(
  client: SupabaseClient,
  escrowId: string,
  txRef: string,
  opts?: { confirmAttempts?: number; pollAttempts?: number; pollIntervalMs?: number }
): Promise<SettleEscrowCheckoutResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, funded: false, error: 'Supabase is not configured.' };
  }

  const confirmAttempts = opts?.confirmAttempts ?? 6;
  let lastConfirmError: string | undefined;

  for (let attempt = 0; attempt < confirmAttempts; attempt++) {
    const confirm = await invokeConfirm(client, escrowId, txRef);
    if (confirm.status === 'funded') {
      return { ok: true, funded: true, partial: confirm.partial };
    }
    if (confirm.partial) {
      return { ok: true, funded: false, partial: true };
    }
    if (confirm.error && confirm.error !== 'pending') {
      lastConfirmError = confirm.error;
      break;
    }
    if (attempt < confirmAttempts - 1) {
      await sleep(1200 + attempt * 600);
    }
  }

  const pollAttempts = opts?.pollAttempts ?? 30;
  const pollIntervalMs = opts?.pollIntervalMs ?? 1500;

  for (let i = 0; i < pollAttempts; i++) {
    if (i > 0) {
      await sleep(pollIntervalMs);
    }
    const esc = await readEscrowStatus(client, escrowId);
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

  const finalEsc = await readEscrowStatus(client, escrowId);
  if (finalEsc?.status === 'funded') {
    return { ok: true, funded: true };
  }

  if (lastConfirmError) {
    return { ok: false, funded: false, error: lastConfirmError };
  }

  return {
    ok: false,
    funded: false,
    pending: true,
    error: 'Your Flutterwave payment went through. We are still syncing escrow.',
  };
}
