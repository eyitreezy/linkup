import type { PlanStatus } from '@/types/database';
import type { LinkedMeetup } from '@/lib/messaging/fetchActiveMeetupWithPeer';
import { getSmartSuggestions, type SuggestionContext } from '@/lib/chat/smartSuggestions';

type PersistedMessage = { tempKey?: string; sender_id: string };

export type ChatPlanSuggestionSource = {
  status: PlanStatus;
  scheduled_at: string | null;
  meet_type_id: string | null;
  creator_id: string;
} | null;

export function planSuggestionSourceFromMeetup(meetup: LinkedMeetup | null): ChatPlanSuggestionSource {
  if (!meetup) return null;
  return {
    status: meetup.status as PlanStatus,
    scheduled_at: meetup.scheduled_at,
    meet_type_id: meetup.meet_type_id,
    creator_id: meetup.creator_id,
  };
}

export function buildChatSuggestionContext(
  plan: ChatPlanSuggestionSource,
  opts: {
    userId: string | undefined;
    isGroupChat: boolean;
    messages: PersistedMessage[];
    composeValue: string;
  }
): string[] {
  const persisted = opts.messages.filter((m) => !m.tempKey);
  const last = persisted[persisted.length - 1];

  const ctx: SuggestionContext = {
    plan: plan
      ? {
          status: plan.status,
          scheduled_at: plan.scheduled_at,
          meet_type_id: plan.meet_type_id,
        }
      : null,
    isHost: !!plan && !!opts.userId && plan.creator_id === opts.userId,
    isGroupChat: opts.isGroupChat,
    messageCount: persisted.length,
    lastMessageIsFromOther:
      persisted.length > 0 && !!opts.userId && last.sender_id !== opts.userId,
    composeValue: opts.composeValue,
  };

  return getSmartSuggestions(ctx);
}
