/**
 * Open 1:1 chat with another user (creates conversation row if needed).
 */
import { getOrCreateConversation } from '@/lib/conversations';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function openDirectChat(
  client: SupabaseClient,
  currentUserId: string,
  otherUserId: string
): Promise<void> {
  const conversationId = await getOrCreateConversation(client, currentUserId, otherUserId);
  router.push(`/chat/${conversationId}` as Href);
}
