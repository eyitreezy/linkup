/**
 * Flutterwave webhook — subscriptions + escrow (sole server activation path).
 *
 * Deploy: npx supabase functions deploy flutterwave-webhook --no-verify-jwt
 */
import { processEscrowCharge } from '../_shared/flutterwaveEscrow.ts';
import { processVirtualAccountBankTransfer } from '../_shared/flutterwaveVirtualAccount.ts';
import {
  fulfillSubscriptionFromVerifiedPayment,
  isSubscriptionFlutterwaveReference,
} from '../_shared/flutterwaveSubscription.ts';
import {
  isEscrowFlutterwaveReference,
  normalizeFlutterwaveMeta,
  parseFlutterwaveAmountNgn,
} from '../_shared/flutterwaveMeta.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type FlwMeta = Record<string, unknown>;

function metaString(meta: FlwMeta | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' ? v : undefined;
}

function resolveEvent(body: Record<string, unknown>): string | null {
  if (typeof body.event === 'string') return body.event;
  if (typeof body.type === 'string') return body.type;
  if (typeof body['event.type'] === 'string') return body['event.type'] as string;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET');
  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const verifHash = req.headers.get('verif-hash');

  if (!webhookSecret || verifHash !== webhookSecret) {
    console.warn('[flutterwave-webhook] auth_failed', {
      hasWebhookSecret: !!webhookSecret,
      hasVerifHash: !!verifHash,
      verifHashMatches: verifHash === webhookSecret,
    });
    return new Response(JSON.stringify({ received: true, ignored: 'auth_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const event = resolveEvent(body);
  const data = (body.data ?? body) as Record<string, unknown>;
  console.log(
    '[flutterwave-webhook] Received event:',
    JSON.stringify(
      {
        event,
        tx_ref: data?.tx_ref,
        status: data?.status,
        amount: data?.amount,
        id: data?.id,
      },
      null,
      2
    )
  );

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
  }

  try {
    if (event === 'charge.completed' || event === 'charge.complete') {
    const txId = data.id;
    if (!txId || !flwSecret) {
      return new Response('Missing transaction id', { status: 400 });
    }

    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
      headers: { Authorization: `Bearer ${flwSecret}` },
    });
    const verifyJson = (await verifyRes.json()) as {
      status?: string;
      data?: {
        status?: string;
        amount?: number;
        tx_ref?: string;
        meta?: FlwMeta;
        customer?: { id?: number };
      };
    };

    if (verifyJson.status !== 'success' || verifyJson.data?.status !== 'successful') {
      return new Response(JSON.stringify({ ok: false, reason: 'verification_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const meta = normalizeFlutterwaveMeta(verifyJson.data?.meta ?? data.meta);
    const reference = verifyJson.data?.tx_ref ?? (data.tx_ref as string | undefined) ?? String(txId);
    const amountNgn = parseFlutterwaveAmountNgn(verifyJson.data?.amount);
    const paymentType =
      typeof verifyJson.data?.payment_type === 'string'
        ? verifyJson.data.payment_type
        : typeof data.payment_type === 'string'
          ? (data.payment_type as string)
          : undefined;
    const linkup = typeof meta.linkup === 'string' ? meta.linkup : undefined;
    const isVirtualAccountRef = reference.startsWith('linkup-va-');
    const isEscrowPayment =
      !isVirtualAccountRef && (linkup === 'escrow' || isEscrowFlutterwaveReference(reference));

    console.log('[flutterwave-webhook] charge.completed resolved', {
      tx_ref: reference,
      linkup,
      isEscrowPayment,
      isVirtualAccountRef,
      paymentType,
      amountNgn,
      meta_keys: Object.keys(meta),
    });

      if (isVirtualAccountRef || paymentType === 'bank_transfer') {
        const vaResponse = await processVirtualAccountBankTransfer(
          supabase,
          reference,
          verifyJson.data,
          txId
        );
        if (!vaResponse.ok) {
          const bodyText = await vaResponse.text();
          console.error('[flutterwave-webhook] bank transfer fulfillment failed', {
            status: vaResponse.status,
            body: bodyText,
            tx_ref: reference,
          });
        }
        const bodyText = await vaResponse.text();
        return new Response(bodyText || JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (isEscrowPayment) {
        const fulfillmentMeta: Record<string, unknown> = {
          ...meta,
          linkup: 'escrow',
        };
        const escrowResponse = await processEscrowCharge(
          supabase,
          fulfillmentMeta,
          reference,
          amountNgn,
          txId
        );
        if (!escrowResponse.ok) {
          const bodyText = await escrowResponse.text();
          console.error('[flutterwave-webhook] escrow fulfillment failed', {
            status: escrowResponse.status,
            body: bodyText,
            tx_ref: reference,
          });
          return new Response(
            JSON.stringify({
              received: true,
              ok: false,
              source_status: escrowResponse.status,
              error: bodyText || 'escrow_fulfillment_failed',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        const bodyText = await escrowResponse.text();
        console.log('[flutterwave-webhook] escrow fulfillment ok', {
          tx_ref: reference,
          body: bodyText,
        });
        return new Response(bodyText || JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

    const isSubscriptionPayment =
      !isVirtualAccountRef &&
      !isEscrowPayment &&
      (linkup === 'subscription' || isSubscriptionFlutterwaveReference(reference));

    if (isSubscriptionPayment) {
      const subResult = await fulfillSubscriptionFromVerifiedPayment(supabase, {
        reference,
        meta,
        amountNgn,
        txId,
        customerId:
          verifyJson.data?.customer?.id != null
            ? String(verifyJson.data.customer.id)
            : undefined,
      });

      if (!subResult.ok) {
        console.error('[flutterwave-webhook] subscription fulfillment failed', {
          reference,
          error: subResult.error,
        });
        return new Response(JSON.stringify({ ok: false, error: subResult.error }), {
          status: subResult.status >= 500 ? 500 : 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true, subscription: true, already: subResult.already === true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, ignored: 'unhandled_charge' }), {
      headers: { 'Content-Type': 'application/json' },
    });
    }

    if (event === 'subscription.cancelled') {
      const meta = (data.meta ?? data) as FlwMeta;
      const userId = metaString(meta, 'user_id') ?? (data.customer_email as string | undefined);
      if (!userId) {
        return new Response('Missing user', { status: 400 });
      }

    const { data: userRow } = await supabase
      .from('users')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'subscription_cancelled',
      from_tier: userRow?.subscription_tier ?? 'FREE',
      to_tier: userRow?.subscription_tier ?? 'FREE',
      metadata: { access_until: userRow?.subscription_expires_at },
    });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event === 'charge.failed') {
      const meta = (data.meta ?? data) as FlwMeta;
      const userId = metaString(meta, 'user_id');
      if (userId) {
        await supabase.from('subscription_events').insert({
          user_id: userId,
          event_type: 'payment_failed',
          metadata: data,
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event === 'transfer.completed' || event === 'transfer.failed') {
      const transferRef =
        (typeof data.reference === 'string' ? data.reference : undefined) ??
        (typeof data.tx_ref === 'string' ? data.tx_ref : undefined);
      if (!transferRef || !transferRef.startsWith('linkup-disburse-')) {
        return new Response(JSON.stringify({ ok: true, ignored: 'not_disburse_ref' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data: request } = await supabase
        .from('disbursement_requests')
        .select('id, user_id, amount_cents, wallet_ledger_debit_id, bank_name')
        .eq('flutterwave_transfer_ref', transferRef)
        .maybeSingle();

      if (!request) {
        console.error('[flutterwave-webhook] No disbursement request for ref:', transferRef);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (event === 'transfer.completed') {
        await supabase
          .from('disbursement_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        await supabase.rpc('create_notification', {
          p_user_id: request.user_id,
          p_type: 'withdrawal_completed',
          p_title: 'Funds received',
          p_body: `Your withdrawal of NGN ${Math.round(request.amount_cents / 100).toLocaleString('en-NG')} has been received by your bank.`,
          p_data: { href: '/wallet' },
          p_priority: 'high',
          p_dedupe_key: `withdrawal_done:${request.id}`,
        });
      } else {
        if (request.wallet_ledger_debit_id) {
          await supabase.from('wallet_ledger').delete().eq('id', request.wallet_ledger_debit_id);
        }

        await supabase
          .from('disbursement_requests')
          .update({
            status: 'failed',
            failure_reason:
              (typeof data.complete_message === 'string' ? data.complete_message : null) ??
              'transfer_failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        await supabase.rpc('create_notification', {
          p_user_id: request.user_id,
          p_type: 'withdrawal_failed',
          p_title: 'Withdrawal failed',
          p_body:
            'Your withdrawal could not be processed. Your funds have been returned to your wallet. Please try again or contact support.',
          p_data: { href: '/wallet' },
          p_priority: 'high',
          p_dedupe_key: `withdrawal_failed:${request.id}`,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, ignored: event }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[flutterwave-webhook] Unhandled error:', {
      error: error instanceof Error ? error.message : String(error),
      event,
      tx_ref: data?.tx_ref,
    });
    return new Response(JSON.stringify({ received: true, error: 'internal_error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
