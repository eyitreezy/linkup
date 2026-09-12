import { isUserEscrowLegFunded } from '@/lib/escrow/splitEscrowFunding';
import { isGroupHostCloseEscrowRow } from '@/lib/plans/groupSplitDynamic';
import type { DbEscrowTransaction } from '@/types/database';

export type GroupFundedMemberEscrowRow = Pick<
  DbEscrowTransaction,
  | 'id'
  | 'guest_id'
  | 'host_id'
  | 'payer_id'
  | 'status'
  | 'escrow_pattern'
  | 'host_funded_at'
  | 'guest_funded_at'
  | 'host_share_cents'
  | 'guest_share_cents'
  | 'amount_cents'
>;

export type GroupFundedMemberPlanSlice = {
  creator_id: string;
  host_escrow_id: string | null;
};

/** Pending host row that is not the canonical plan.host_escrow_id row. */
export function isGhostHostEscrowRow(
  plan: { host_escrow_id: string | null },
  escrow: Pick<DbEscrowTransaction, 'id' | 'guest_id' | 'host_funded_at'>
): boolean {
  return (
    escrow.guest_id == null &&
    !escrow.host_funded_at &&
    plan.host_escrow_id != null &&
    escrow.id !== plan.host_escrow_id
  );
}

/** Real group escrow legs — guest rows and the canonical host close row only. */
export function filterRealGroupEscrowRows(
  plan: { host_escrow_id: string | null },
  escrows: GroupFundedMemberEscrowRow[]
): GroupFundedMemberEscrowRow[] {
  return escrows.filter((row) => {
    if (isGhostHostEscrowRow(plan, row)) return false;
    if (row.guest_id != null) return true;
    return isGroupHostCloseEscrowRow(plan, row);
  });
}

/** True when every real escrow leg on the plan has funded. Ghost rows are ignored. */
export function areAllRealGroupEscrowLegsFunded(
  plan: GroupFundedMemberPlanSlice,
  escrows: GroupFundedMemberEscrowRow[]
): boolean {
  const realRows = filterRealGroupEscrowRows(plan, escrows);
  if (realRows.length === 0) return false;

  return realRows.every((row) => {
    if (row.guest_id != null) {
      return isUserEscrowLegFunded(row, row.guest_id);
    }
    return isUserEscrowLegFunded(row, plan.creator_id);
  });
}

/** Count of members (host + guests) who have funded their escrow leg. */
export function countGroupFundedMembers(
  plan: GroupFundedMemberPlanSlice,
  escrows: GroupFundedMemberEscrowRow[]
): number {
  const realRows = filterRealGroupEscrowRows(plan, escrows);
  let count = 0;

  const hostRow = plan.host_escrow_id
    ? realRows.find((row) => row.id === plan.host_escrow_id)
    : realRows.find((row) => row.guest_id == null);

  if (hostRow && isUserEscrowLegFunded(hostRow, plan.creator_id)) {
    count += 1;
  }

  const seenGuestIds = new Set<string>();
  for (const row of realRows) {
    if (row.guest_id == null || seenGuestIds.has(row.guest_id)) continue;
    seenGuestIds.add(row.guest_id);
    if (isUserEscrowLegFunded(row, row.guest_id)) {
      count += 1;
    }
  }

  return count;
}
