import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlanOffer } from '@/types/database';

export async function submitOfferOrCounter(
  supabase: SupabaseClient,
  params: {
    planId: string;
    amountCents: number | null;
    note?: string | null;
    proposedScheduledAt?: string | null;
    offerId?: string | null;
  }
): Promise<{ offerId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_offer_or_counter', {
    p_plan_id: params.planId,
    p_amount_cents: params.amountCents,
    p_note: params.note ?? null,
    p_proposed_scheduled_at: params.proposedScheduledAt ?? null,
    p_offer_id: params.offerId ?? null,
  });
  if (error) return { offerId: null, error: error.message };
  return { offerId: typeof data === 'string' ? data : null, error: null };
}

export async function hostRespondToOffer(
  supabase: SupabaseClient,
  params: {
    offerId: string;
    action: 'accept' | 'counter' | 'decline';
    counterAmountCents?: number | null;
    note?: string | null;
    proposedScheduledAt?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('host_respond_to_offer', {
    p_offer_id: params.offerId,
    p_action: params.action,
    p_counter_amount_cents: params.counterAmountCents ?? null,
    p_note: params.note ?? null,
    p_proposed_scheduled_at: params.proposedScheduledAt ?? null,
  });
  return { error: error?.message ?? null };
}

export async function guestRespondToCounter(
  supabase: SupabaseClient,
  params: {
    offerId: string;
    action: 'accept' | 'counter' | 'decline';
    counterAmountCents?: number | null;
    note?: string | null;
    proposedScheduledAt?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('guest_respond_to_counter', {
    p_offer_id: params.offerId,
    p_action: params.action,
    p_counter_amount_cents: params.counterAmountCents ?? null,
    p_note: params.note ?? null,
    p_proposed_scheduled_at: params.proposedScheduledAt ?? null,
  });
  return { error: error?.message ?? null };
}

export async function withdrawOffer(
  supabase: SupabaseClient,
  offerId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('withdraw_offer', { p_offer_id: offerId });
  return { error: error?.message ?? null };
}

export function defaultCounterAmount(offer: DbPlanOffer): string {
  const cents = offer.current_amount_cents ?? offer.amount_cents;
  if (cents == null) return '';
  return String(cents / 100);
}
