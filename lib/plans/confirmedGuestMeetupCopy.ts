import type { DbPlan } from '@/types/database';

/** Confirmed guest helper copy on Meetup Details (Your request card). */
export function confirmedGuestMeetupMessage(plan: Pick<DbPlan, 'is_group_plan'>): string {
  if (plan.is_group_plan) {
    return 'You are confirmed on this group plan. View your agreement or message the group from the actions above.';
  }
  return 'You are confirmed for this plan. View your agreement or continue with the available actions above.';
}

export const VIEW_AGREEMENT_PAY_LABEL = 'View agreement & pay';
