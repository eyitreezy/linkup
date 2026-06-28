import type { DbPlan } from '@/types/database';

export interface SuggestionContext {
  plan: Pick<DbPlan, 'status' | 'scheduled_at' | 'meet_type_id'> | null;
  isHost: boolean;
  isGroupChat: boolean;
  messageCount: number;
  lastMessageIsFromOther: boolean;
  composeValue: string;
}

export function getSmartSuggestions(ctx: SuggestionContext): string[] {
  const { plan, isHost, messageCount, lastMessageIsFromOther, composeValue } = ctx;

  if (composeValue.trim().length > 0) return [];

  if (plan?.status === 'cancelled') return [];

  const now = new Date();
  const scheduledAt = plan?.scheduled_at ? new Date(plan.scheduled_at) : null;
  const hoursUntilPlan = scheduledAt
    ? (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    : null;
  const isWithin24h = hoursUntilPlan !== null && hoursUntilPlan > 0 && hoursUntilPlan <= 24;
  const isHappeningNow = plan?.status === 'active';
  const isCompleted = plan?.status === 'completed';
  const isAwaitingPayment = plan?.status === 'awaiting_payment';

  if (isCompleted) {
    return [
      'That was great, thanks! 😊',
      'Really enjoyed that!',
      'Thanks for the plan!',
      'Would love to do this again',
    ];
  }

  if (isHappeningNow) {
    return [
      "I'm here! 👋",
      'On my way now 🚶',
      'Running a few minutes late, sorry!',
      'Just arrived!',
    ];
  }

  if (isWithin24h) {
    return [
      'Still on for today? 👍',
      'All set for later!',
      'What time works best?',
      'Quick question about the location',
    ];
  }

  if (isAwaitingPayment) {
    if (isHost) {
      return [
        'Ready to lock in the plan?',
        'Just a reminder about the payment',
        "Let me know when you've sorted the escrow",
      ];
    }
    return [
      'Ready to complete the payment',
      'All set to lock this in!',
      'Sorting the payment now',
    ];
  }

  if (messageCount === 0) {
    return [
      'Hey! Looking forward to this 👋',
      "Hi, just confirming we're still on?",
      'Hey! Any questions before we meet?',
      'Looking forward to meeting you!',
    ];
  }

  if (lastMessageIsFromOther && messageCount > 0) {
    return [
      'Sounds good! 👍',
      'Perfect, see you then!',
      'That works for me',
      'Great, thanks!',
    ];
  }

  return [];
}
