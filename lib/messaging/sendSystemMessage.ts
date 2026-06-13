import { runMessageSelect } from '@/lib/messaging/chatQueries';
import { supabase } from '@/lib/supabase';

export async function sendSystemMessage(
  conversationId: string,
  body: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await runMessageSelect((cols) =>
    supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: null,
        text: body,
        moderation_status: 'clean',
      })
      .select(cols)
      .single()
  );
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not send system message' };
  return { ok: true, id: (data as { id: string }).id };
}
