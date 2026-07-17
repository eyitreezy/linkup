import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import type { PlanRowFromDb } from '@/lib/plans/planFeedMerge';

type DiscoverFeedSession = {
  userId: string | null;
  rows: PlanFeedRow[];
  acc: PlanRowFromDb[];
  page: number;
  hasMore: boolean;
};

const emptySession = (): DiscoverFeedSession => ({
  userId: null,
  rows: [],
  acc: [],
  page: 0,
  hasMore: true,
});

let session: DiscoverFeedSession = emptySession();

export function peekDiscoverFeedSession(userId?: string | null): DiscoverFeedSession {
  if (!userId || !session.userId || session.userId !== userId) {
    return emptySession();
  }
  return session;
}

export function writeDiscoverFeedSession(
  userId: string | null | undefined,
  next: Partial<Omit<DiscoverFeedSession, 'userId'>>
): void {
  if (!userId) return;
  session = {
    ...session,
    userId,
    ...next,
  };
}

export function clearDiscoverFeedSession(): void {
  session = emptySession();
}
