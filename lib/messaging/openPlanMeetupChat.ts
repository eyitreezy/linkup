import { createGroupChat } from '@/lib/messaging/createGroupChat';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { Href } from 'expo-router';
import { router } from 'expo-router';

export class PlanMeetupChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanMeetupChatError';
  }
}

export type OpenPlanMeetupChatParams = {
  plan: DbPlan;
  userId: string;
  isCreator: boolean;
  offers: DbPlanOffer[];
};

/** Open chat for a plan: 1:1 with host/counterparty, or the plan's group thread. */
export async function openPlanMeetupChat({
  plan,
  userId,
  isCreator,
  offers,
}: OpenPlanMeetupChatParams): Promise<void> {
  if (plan.is_group_plan) {
    await openGroupPlanMeetupChat({ plan, userId, offers });
    return;
  }

  const sorted = [...offers].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const lastBidder = [...sorted].reverse().find((o) => o.bidder_id !== plan.creator_id)?.bidder_id;
  const other = isCreator ? lastBidder ?? null : plan.creator_id;
  if (!other) {
    throw new PlanMeetupChatError(
      isCreator ? 'No one’s raised their hand yet. Check back soon.' : 'Could not open chat.'
    );
  }

  await openDirectChat(supabase, userId, other, { skipOfferGate: true });
}

async function openGroupPlanMeetupChat({
  plan,
  userId,
  offers,
}: {
  plan: DbPlan;
  userId: string;
  offers: DbPlanOffer[];
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new PlanMeetupChatError('Chat unavailable.');
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('plan_id', plan.id)
    .eq('is_group_chat', true)
    .maybeSingle();

  if (existing?.id) {
    router.push(`/chat/group/${existing.id}` as Href);
    return;
  }

  if (plan.creator_id !== userId) {
    throw new PlanMeetupChatError('The host has not opened the group chat yet.');
  }

  const bidderIds = [
    ...new Set(
      offers.map((o) => o.bidder_id).filter((id): id is string => !!id && id !== plan.creator_id)
    ),
  ];

  const convId = await createGroupChat({
    planId: plan.id,
    hostId: userId,
    groupName: plan.title,
    initialMemberIds: bidderIds,
  });
  router.push(`/chat/group/${convId}` as Href);
}
