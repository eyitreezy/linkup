/** One-shot meet type filter when navigating from Meetr → Discover. */
export type PendingMeetTypeFilter = {
  id: string;
  name: string;
};

let pending: PendingMeetTypeFilter | null = null;

export function setPendingMeetTypeFilter(filter: PendingMeetTypeFilter): void {
  pending = filter;
}

export function consumePendingMeetTypeFilter(): PendingMeetTypeFilter | null {
  const next = pending;
  pending = null;
  return next;
}
