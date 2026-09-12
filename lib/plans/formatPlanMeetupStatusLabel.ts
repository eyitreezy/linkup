import type { DbPlan, PlanStatus } from '@/types/database';

const STATUS_LABELS: Partial<Record<PlanStatus, string>> = {
  negotiating: 'Negotiating',
  agreed: 'Agreed',
  awaiting_payment: 'Awaiting payment',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
};

/** Meetup Details status pill — respects negotiable vs fixed plan configuration. */
export function formatPlanMeetupStatusLabel(
  plan: Pick<DbPlan, 'is_negotiable' | 'status'>
): string {
  if (plan.is_negotiable === false) return 'Fixed';
  const raw = plan.status;
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw]!;
  if (!raw) return 'Open';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
