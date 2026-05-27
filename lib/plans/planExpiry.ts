import type { DbPlan } from '@/types/database';

type PlanLike = Pick<DbPlan, 'is_mood_plan' | 'is_expired' | 'mood_expires_at'>;

/** True when mood listing / negotiation must be treated as closed (server or client clock). */
export function isPlanMoodWindowClosed(plan: PlanLike, nowMs: number = Date.now()): boolean {
  if (!plan.is_mood_plan) return false;
  if (plan.is_expired) return true;
  if (plan.mood_expires_at) return new Date(plan.mood_expires_at).getTime() <= nowMs;
  return false;
}

export function planExpiryReason(plan: PlanLike, nowMs: number = Date.now()): string {
  if (!plan.is_mood_plan) return '';
  if (plan.is_expired || isPlanMoodWindowClosed(plan, nowMs)) {
    return 'This mood moment ended — it now stays on your shelf for memories, not the public floor.';
  }
  return '';
}
