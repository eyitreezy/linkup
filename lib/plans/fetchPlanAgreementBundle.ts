import { isGroupSplitPlan } from '@/lib/plans/groupSplitDynamic';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbEscrowTransaction, DbPlan, DbPlanOffer } from '@/types/database';

export type AgreementProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_badge: boolean | null;
};

export type PlanAgreementBundle = {
  plan: DbPlan;
  offer: DbPlanOffer;
  hostProfile: AgreementProfile | null;
  guestProfile: AgreementProfile | null;
  confirmationUserIds: string[];
  escrowId: string | null;
  escrowCents: number | null;
  myEscrow: DbEscrowTransaction | null;
  guestEscrowRows: DbEscrowTransaction[];
  mutualVoteIds: string[];
  counterpartyKycTier: number | null;
};

async function resolveAgreementEscrows(
  client: SupabaseClient,
  plan: DbPlan,
  offer: DbPlanOffer,
  userId: string | null | undefined,
  paymentRequired: boolean
): Promise<{ myEscrow: DbEscrowTransaction | null; guestEscrowRows: DbEscrowTransaction[] }> {
  if (!paymentRequired) {
    return { myEscrow: null, guestEscrowRows: [] };
  }

  const isHost = userId === plan.creator_id;
  const groupSplit = isGroupSplitPlan(plan);

  if (groupSplit) {
    if (isHost) {
      const hostEscrowId = plan.host_escrow_id;
      const [{ data: hostEscrow }, { data: guestRows }] = await Promise.all([
        hostEscrowId
          ? client.from('escrow_transactions').select('*').eq('id', hostEscrowId).maybeSingle()
          : Promise.resolve({ data: null as DbEscrowTransaction | null }),
        client
          .from('escrow_transactions')
          .select('*')
          .eq('plan_id', plan.id)
          .not('guest_id', 'is', null),
      ]);
      return {
        myEscrow: (hostEscrow as DbEscrowTransaction | null) ?? null,
        guestEscrowRows: (guestRows ?? []) as DbEscrowTransaction[],
      };
    }

    if (userId) {
      const { data: guestEscrow } = await client
        .from('escrow_transactions')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('guest_id', userId)
        .maybeSingle();
      return {
        myEscrow: (guestEscrow as DbEscrowTransaction | null) ?? null,
        guestEscrowRows: [],
      };
    }

    return { myEscrow: null, guestEscrowRows: [] };
  }

  if (offer.bidder_id) {
    const { data: escrowRow } = await client
      .from('escrow_transactions')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('guest_id', offer.bidder_id)
      .maybeSingle();
    return {
      myEscrow: (escrowRow as DbEscrowTransaction | null) ?? null,
      guestEscrowRows: [],
    };
  }

  return { myEscrow: null, guestEscrowRows: [] };
}

async function resolveAgreementOffer(
  client: SupabaseClient,
  plan: DbPlan,
  opts?: { offerId?: string | null; userId?: string | null }
): Promise<DbPlanOffer | null> {
  if (opts?.offerId) {
    const { data } = await client.from('plan_offers').select('*').eq('id', opts.offerId).maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  if (plan.accepted_offer_id) {
    const { data } = await client
      .from('plan_offers')
      .select('*')
      .eq('id', plan.accepted_offer_id)
      .maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  if (opts?.userId) {
    const { data } = await client
      .from('plan_offers')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('bidder_id', opts.userId)
      .eq('status', 'accepted')
      .maybeSingle();
    if (data) return data as DbPlanOffer;
  }
  return null;
}

export async function fetchPlanAgreementBundle(
  client: SupabaseClient,
  planId: string,
  opts?: { offerId?: string | null; userId?: string | null }
): Promise<{ data: PlanAgreementBundle | null; error: string | null }> {
  const { data: planRow, error: planError } = await client
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();

  if (planError) return { data: null, error: planError.message };
  if (!planRow) return { data: null, error: 'Plan not found' };

  const plan = planRow as DbPlan;
  const offer = await resolveAgreementOffer(client, plan, opts);
  if (!offer || offer.status !== 'accepted') {
    return { data: null, error: 'No accepted offer for this plan' };
  }

  const isParty = opts?.userId === plan.creator_id || opts?.userId === offer.bidder_id;
  if (opts?.userId && !isParty) {
    return { data: null, error: 'No access to this agreement' };
  }

  const bidderId = offer.bidder_id;
  const paymentRequired =
    (plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0) > 0;

  const [
    { data: hostProfile },
    { data: guestProfile },
    { data: confirmations },
    { data: guestUser },
    { data: mutualVotes },
    escrowBundle,
  ] = await Promise.all([
    client
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .eq('user_id', plan.creator_id)
      .maybeSingle(),
    client
      .from('profiles')
      .select('user_id, display_name, avatar_url, verified_badge')
      .eq('user_id', bidderId)
      .maybeSingle(),
    client.from('agreement_confirmations').select('user_id').eq('plan_id', planId),
    client.from('users').select('kyc_tier').eq('id', bidderId).maybeSingle(),
    client.from('mutual_plan_cancel_votes').select('user_id').eq('plan_id', planId),
    resolveAgreementEscrows(client, plan, offer, opts?.userId, paymentRequired),
  ]);

  const { myEscrow, guestEscrowRows } = escrowBundle;

  return {
    data: {
      plan,
      offer,
      hostProfile: (hostProfile as AgreementProfile | null) ?? null,
      guestProfile: (guestProfile as AgreementProfile | null) ?? null,
      confirmationUserIds: (confirmations ?? []).map((c) => c.user_id as string),
      escrowId: myEscrow?.id ?? null,
      escrowCents: myEscrow?.amount_cents ?? null,
      myEscrow,
      guestEscrowRows,
      mutualVoteIds: (mutualVotes ?? []).map((r) => r.user_id as string),
      counterpartyKycTier: (guestUser?.kyc_tier as number | undefined) ?? null,
    },
    error: null,
  };
}
