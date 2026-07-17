import { getEscrowFundingUiState } from '@/lib/escrow/escrowFundingUi';
import { isUserEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import {
  isGroupHostCloseEscrowRow,
  isGroupSplitPlan,
  resolveGroupHostShareCents,
} from '@/lib/plans/groupSplitDynamic';
import type { DbEscrowTransaction, DbPlan } from '@/types/database';

type GuestEscrowLeg = Pick<DbEscrowTransaction, 'guest_id' | 'guest_share_cents' | 'amount_cents'>;

type EscrowAccessFields = Pick<
  DbEscrowTransaction,
  | 'status'
  | 'escrow_pattern'
  | 'host_id'
  | 'guest_id'
  | 'payer_id'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'amount_cents'
  | 'id'
>;

type GroupAccessContext = {
  plan: Pick<
    DbPlan,
    | 'is_group_plan'
    | 'is_paid'
    | 'escrow_pattern'
    | 'host_escrow_id'
    | 'group_closed_at'
    | 'starting_price_cents'
    | 'agreed_price_cents'
    | 'accepted_guest_amounts_sum_cents'
    | 'budget_min_cents'
    | 'budget_max_cents'
  > | null;
  guestEscrowRows?: GuestEscrowLeg[];
  hostEscrowRow?: Pick<
    DbEscrowTransaction,
    'id' | 'host_share_cents' | 'amount_cents' | 'guest_id' | 'host_funded_at'
  > | null;
};

/** Mirrors `/escrow/[id]` fund CTA eligibility for the bank-transfer screen. */
export function canUserAccessBankTransfer(
  escrow: EscrowAccessFields,
  userId: string,
  group?: GroupAccessContext
): boolean {
  if (escrow.status !== 'pending_funding') return false;

  const fundingUi = getEscrowFundingUiState(escrow, userId);
  if (fundingUi.canFund) return true;

  const plan = group?.plan;
  if (!plan || !isGroupSplitPlan(plan) || userId !== escrow.host_id) return false;
  if (escrow.guest_id != null && !isGroupHostCloseEscrowRow(plan, escrow)) return false;
  if (isUserEscrowLegFunded(escrow, userId)) return false;

  const groupHostShare = resolveGroupHostShareCents(plan, escrow, group.guestEscrowRows ?? [], {
    hostEscrowRow: group.hostEscrowRow ?? null,
  });
  const myPayShareCents = Math.max(groupHostShare.displayCents, groupHostShare.paymentCents);

  return myPayShareCents > 0;
}
