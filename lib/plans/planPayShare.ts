import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import type { DbPlan, DbEscrowTransaction } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanGuestEscrowSnapshot = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'status'
  | 'escrow_pattern'
  | 'payer_id'
  | 'host_id'
  | 'guest_id'
  | 'amount_cents'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'host_funded_at'
  | 'guest_funded_at'
>;

export type PlanPayShareState = {
  showPayShare: boolean;
  payShareEscrowId: string | null;
  payShareAmountLabel: string | null;
};

const INACTIVE_PLAN_STATUSES = new Set(['cancelled', 'draft']);

export function resolvePlanPayShareState(
  plan: Pick<DbPlan, 'status' | 'is_paid' | 'currency'>,
  userId: string | undefined,
  myGuestEscrow: PlanGuestEscrowSnapshot | null | undefined,
  isHost: boolean
): PlanPayShareState {
  const idle: PlanPayShareState = {
    showPayShare: false,
    payShareEscrowId: null,
    payShareAmountLabel: null,
  };

  if (!userId || isHost || !myGuestEscrow || !plan.is_paid) return idle;
  if (INACTIVE_PLAN_STATUSES.has(plan.status)) return idle;

  const funding = getEscrowFundingUiState(
    myGuestEscrow as Parameters<typeof getEscrowFundingUiState>[0],
    userId
  );
  if (!funding.canFund) return idle;

  return {
    showPayShare: true,
    payShareEscrowId: myGuestEscrow.id,
    payShareAmountLabel:
      funding.payAmountCents > 0
        ? formatEscrowMoney(funding.payAmountCents, plan.currency ?? 'NGN')
        : null,
  };
}

/** Latest guest-leg escrow row for the viewer on this plan. */
export async function fetchViewerGuestEscrow(
  client: SupabaseClient,
  planId: string,
  viewerId: string
): Promise<PlanGuestEscrowSnapshot | null> {
  const { data } = await client
    .from('escrow_transactions')
    .select(
      'id, status, escrow_pattern, payer_id, host_id, guest_id, amount_cents, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'
    )
    .eq('plan_id', planId)
    .eq('guest_id', viewerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PlanGuestEscrowSnapshot | null) ?? null;
}
