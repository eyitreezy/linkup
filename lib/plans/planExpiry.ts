import type { DbPlan } from '@/types/database';

export type PlanExpireLike = Pick<
  DbPlan,
  'is_mood_plan' | 'is_expired' | 'mood_expires_at' | 'active_expires_at' | 'status'
>;

/** True when mood listing / negotiation must be treated as closed (server or client clock). */
export function isPlanMoodWindowClosed(plan: PlanExpireLike, nowMs: number = Date.now()): boolean {
  if (!plan.is_mood_plan) return false;
  if (plan.is_expired) return true;
  if (plan.mood_expires_at) return new Date(plan.mood_expires_at).getTime() <= nowMs;
  return false;
}

/** Standard (non-mood) Discover listing window ended. */
export function isStandardListingExpired(plan: PlanExpireLike, nowMs: number = Date.now()): boolean {
  if (plan.is_mood_plan) return false;
  if (plan.is_expired) return true;
  if (plan.active_expires_at) return new Date(plan.active_expires_at).getTime() <= nowMs;
  return false;
}

/** Whether a plan should be excluded from public Discover feeds. */
export function isPlanDiscoverExpired(plan: PlanExpireLike, nowMs: number = Date.now()): boolean {
  if (plan.is_mood_plan) return isPlanMoodWindowClosed(plan, nowMs);
  return isStandardListingExpired(plan, nowMs);
}

/**
 * Whether new participation is closed: offers, joins, shares, invitations.
 * Uses authoritative date fields rather than stale booleans alone.
 */
export function isPlanParticipationClosed(plan: PlanExpireLike, nowMs: number = Date.now()): boolean {
  if (plan.status === 'cancelled' || plan.status === 'completed') return true;
  return isPlanDiscoverExpired(plan, nowMs);
}

export function planExpiredAtIso(plan: PlanExpireLike): string | null {
  if (plan.is_mood_plan) return plan.mood_expires_at ?? null;
  return plan.active_expires_at ?? null;
}

export function planExpiryReason(plan: PlanExpireLike, nowMs: number = Date.now()): string {
  if (plan.is_mood_plan) {
    if (plan.is_expired || isPlanMoodWindowClosed(plan, nowMs)) {
      return 'This mood moment ended. It stays on your shelf for memories, not the public floor.';
    }
    return '';
  }
  if (isStandardListingExpired(plan, nowMs)) {
    return 'This plan’s listing window ended. It stays on your shelf for reference — new guests, offers, and invites are paused.';
  }
  return '';
}

/** @deprecated use isPlanParticipationClosed */
export function isPlanExpired(plan: PlanExpireLike, nowMs: number = Date.now()): boolean {
  return isPlanParticipationClosed(plan, nowMs);
}
