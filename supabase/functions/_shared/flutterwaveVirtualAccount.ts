import { dispatchUserNotification } from './dispatch.ts';
import { maybeActivatePlanAfterFunding } from './flutterwaveEscrow.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type FlwVerifyData = {
  tx_ref?: string;
  meta?: Record<string, unknown> | unknown;
  id?: number | string;
};

function senderFromMeta(metaRaw: unknown): {
  account_number?: string;
  bank_code?: string;
  bank_name?: string;
} {
  if (!metaRaw || typeof metaRaw !== 'object') return {};
  const meta = metaRaw as Record<string, unknown>;
  const sender = meta.sender;
  if (!sender || typeof sender !== 'object') return {};
  const row = sender as Record<string, unknown>;
  return {
    account_number: typeof row.account_number === 'string' ? row.account_number : undefined,
    bank_code: typeof row.bank_code === 'string' ? row.bank_code : undefined,
    bank_name: typeof row.bank_name === 'string' ? row.bank_name : undefined,
  };
}

export async function processVirtualAccountBankTransfer(
  supabase: SupabaseClient,
  orderRef: string,
  verifyData: FlwVerifyData | undefined,
  flwTransactionId?: string | number | null
): Promise<Response> {
  if (!orderRef.startsWith('linkup-va-')) {
    return new Response(JSON.stringify({ ok: true, ignored: 'not_va_ref' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: session, error: sessionErr } = await supabase
    .from('virtual_account_sessions')
    .select(
      `
      id,
      escrow_id,
      user_id,
      refund_account_id,
      expires_at,
      status,
      escrow:escrow_transactions(
        id,
        plan_id,
        payer_id,
        payee_id,
        host_id,
        guest_id,
        escrow_pattern,
        host_share_cents,
        guest_share_cents,
        host_funded_at,
        guest_funded_at,
        amount_cents,
        status,
        metadata
      )
    `
    )
    .eq('flutterwave_order_ref', orderRef)
    .eq('status', 'pending')
    .maybeSingle();

  if (sessionErr || !session) {
    console.error('[webhook-bank-transfer] No pending session for order_ref:', orderRef, sessionErr?.message);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from('virtual_account_sessions').update({ status: 'expired' }).eq('id', session.id);
    return new Response(JSON.stringify({ ok: true, expired: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const escrow = session.escrow as Record<string, unknown> | null;
  if (!escrow?.id || !escrow.plan_id) {
    console.error('[webhook-bank-transfer] Escrow missing on session', session.id);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sender = senderFromMeta(verifyData?.meta);
  const nowIso = new Date().toISOString();
  const pattern = escrow.escrow_pattern as string | null;
  const escrowId = String(escrow.id);
  const planId = String(escrow.plan_id);

  const bankFields = {
    payment_method: 'bank_transfer',
    payment_tx_ref: orderRef,
    refund_account_id: session.refund_account_id ?? null,
    sender_bank_account_number: sender.account_number ?? null,
    sender_bank_code: sender.bank_code ?? null,
    sender_bank_name: sender.bank_name ?? null,
  };

  if (flwTransactionId != null && String(flwTransactionId).length > 0) {
    Object.assign(bankFields, { flutterwave_transaction_id: String(flwTransactionId) });
  }

  if (pattern === 'B') {
    const isHost = session.user_id === escrow.host_id;
    const isGuest = session.user_id === escrow.guest_id;

    const prevMeta = (escrow.metadata ?? {}) as Record<string, unknown>;
    const escrowLeg = typeof prevMeta.leg === 'string' ? prevMeta.leg : null;
    const isGroupSplitRow = escrowLeg === 'host_close' || escrowLeg === 'guest_slot';

    if (isGroupSplitRow) {
      const { error: upErr } = await supabase
        .from('escrow_transactions')
        .update({
          ...bankFields,
          status: 'funded',
          funded_at: nowIso,
          metadata: {
            ...prevMeta,
            bank_transfer_confirmed_at: nowIso,
            payment_reference: orderRef,
            last_leg: isHost ? 'host' : 'guest',
          },
          updated_at: nowIso,
        })
        .eq('id', escrowId)
        .eq('status', 'pending_funding');

      if (upErr) {
        console.error('[webhook-bank-transfer] group split fund update failed', upErr.message);
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      if (!isHost && !isGuest) {
        console.error('[webhook-bank-transfer] payer not host/guest on split escrow', session.user_id);
        return new Response(JSON.stringify({ ok: false, error: 'invalid_split_payer' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const nextHost = isHost ? nowIso : (escrow.host_funded_at as string | null);
      const nextGuest = isGuest ? nowIso : (escrow.guest_funded_at as string | null);

      const legPatch: Record<string, unknown> = {
        ...bankFields,
        host_funded_at: nextHost,
        guest_funded_at: nextGuest,
        metadata: {
          ...prevMeta,
          bank_transfer_confirmed_at: nowIso,
          payment_reference: orderRef,
          last_leg: isHost ? 'host' : 'guest',
        },
        updated_at: nowIso,
      };

      const { data: upRows, error: upErr } = await supabase
        .from('escrow_transactions')
        .update(legPatch)
        .eq('id', escrowId)
        .select('host_funded_at, guest_funded_at');

      if (upErr) {
        console.error('[webhook-bank-transfer] split update failed', upErr.message);
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const row = upRows?.[0] as { host_funded_at: string | null; guest_funded_at: string | null } | undefined;
      if (row?.host_funded_at && row?.guest_funded_at) {
        await supabase
          .from('escrow_transactions')
          .update({ status: 'funded', funded_at: nowIso, updated_at: nowIso })
          .eq('id', escrowId)
          .eq('status', 'pending_funding');
      }
    }
  } else {
    const { error: upErr } = await supabase
      .from('escrow_transactions')
      .update({
        ...bankFields,
        status: 'funded',
        funded_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', escrowId)
      .eq('status', 'pending_funding');

    if (upErr) {
      console.error('[webhook-bank-transfer] fund update failed', upErr.message);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  await supabase.from('virtual_account_sessions').update({ status: 'funded' }).eq('id', session.id);

  await supabase.rpc('check_plan_escrow_fully_funded', { p_plan_id: planId });
  await maybeActivatePlanAfterFunding(supabase, planId, nowIso);

  await dispatchUserNotification(supabase, {
    userId: session.user_id,
    type: 'escrow_funded_bank_transfer',
    title: 'Payment received',
    body: 'Your bank transfer has been received and your escrow is funded.',
    data: {
      href: `/plan/${planId}/agreement`,
      planId,
      escrowId,
      type: 'escrow_funded_bank_transfer',
    },
    priority: 'high',
    dedupeKey: `escrow_va_fund:${orderRef}:${session.user_id}`,
  });

  return new Response(JSON.stringify({ ok: true, bank_transfer: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
