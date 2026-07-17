import type { DiscoverPlanUpdateRow } from '@/lib/discovery/subscribeDiscoverPlansRealtime';

/** Plan should leave the public discover feed (swipe deck + list). */
export function shouldRemovePlanFromDiscoverFeed(row: DiscoverPlanUpdateRow): boolean {
  return (
    row.is_suppressed === true ||
    (row.archived_at != null && row.archived_at !== '') ||
    (row.status != null &&
      ['agreed', 'active', 'completed', 'cancelled'].includes(row.status)) ||
    (row.status === 'awaiting_payment' && !row.is_group_plan)
  );
}
