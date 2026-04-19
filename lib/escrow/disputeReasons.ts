export type DisputeReasonOption = { id: string; label: string };

/** Guided reasons for escrow disputes (Support + escrow_disputes.reason). */
export const ESCROW_DISPUTE_REASONS: DisputeReasonOption[] = [
  { id: 'no_show', label: 'The other person did not show up' },
  { id: 'misrepresented', label: 'Plan details were misrepresented' },
  { id: 'unsafe', label: 'Safety or comfort concern' },
  { id: 'payment', label: 'Payment or amount issue' },
  { id: 'other', label: 'Something else' },
];

export function disputeReasonLabel(id: string): string {
  return ESCROW_DISPUTE_REASONS.find((r) => r.id === id)?.label ?? id;
}
