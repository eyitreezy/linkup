/** Host-facing copy when a searched user is already on the plan. */
export function invitationSearchAlreadyMemberLabel(gender: string | null | undefined): string {
  const normalized = gender?.trim().toLowerCase();
  if (normalized === 'man') return 'He is already a member';
  if (normalized === 'woman') return 'She is already a member';
  return 'They are already a member';
}
