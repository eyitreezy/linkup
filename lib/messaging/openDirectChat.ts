/**
 * Open 1:1 chat with another user (creates conversation row if needed).
 */
import { getOrCreateConversation } from '@/lib/conversations';
import {
  checkOfferBeforeChat,
  type OfferBeforeChatResult,
} from '@/lib/messaging/offerBeforeChatGate';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import type { SupabaseClient } from '@supabase/supabase-js';

export class OfferRequiredBeforeChatError extends Error {
  planId: string | null;

  constructor(planId: string | null) {
    super('Offer required before chat');
    this.name = 'OfferRequiredBeforeChatError';
    this.planId = planId;
  }
}

export type OpenDirectChatOptions = {
  /** Skip offer gate (e.g. plan agreement with accepted offer). */
  skipOfferGate?: boolean;
};

export async function openDirectChat(
  client: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
  options?: OpenDirectChatOptions
): Promise<void> {
  if (!options?.skipOfferGate) {
    const gate = await checkOfferBeforeChat(currentUserId, otherUserId);
    if (!gate.allowed) {
      throw new OfferRequiredBeforeChatError(gate.planId);
    }
  }

  const conversationId = await getOrCreateConversation(client, currentUserId, otherUserId);
  router.push(`/chat/${conversationId}` as Href);
}

export async function peekOfferBeforeChat(
  currentUserId: string,
  otherUserId: string
): Promise<OfferBeforeChatResult> {
  return checkOfferBeforeChat(currentUserId, otherUserId);
}
