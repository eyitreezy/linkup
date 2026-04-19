import { supabase } from '@/lib/supabase';
import type { DbUserPresence } from '@/types/database';

export async function upsertOnlineHeartbeat(userId: string): Promise<void> {
  const iso = new Date().toISOString();
  const { data: existing } = await supabase.from('user_presence').select('user_id').eq('user_id', userId).maybeSingle();
  if (existing) {
    await supabase
      .from('user_presence')
      .update({ is_online: true, last_seen: iso })
      .eq('user_id', userId);
  } else {
    await supabase.from('user_presence').insert({
      user_id: userId,
      is_online: true,
      last_seen: iso,
    });
  }
}

export async function setOfflinePresence(userId: string): Promise<void> {
  const iso = new Date().toISOString();
  await supabase
    .from('user_presence')
    .update({ is_online: false, last_seen: iso, typing_conversation_id: null, typing_updated_at: null })
    .eq('user_id', userId);
}

export async function updateTypingTarget(
  userId: string,
  conversationId: string | null
): Promise<void> {
  const patch: Partial<DbUserPresence> = {
    typing_conversation_id: conversationId,
    typing_updated_at: conversationId ? new Date().toISOString() : null,
  };
  const { data: existing } = await supabase.from('user_presence').select('user_id').eq('user_id', userId).maybeSingle();
  if (!existing && conversationId) {
    await supabase.from('user_presence').insert({
      user_id: userId,
      is_online: true,
      last_seen: new Date().toISOString(),
      typing_conversation_id: conversationId,
      typing_updated_at: patch.typing_updated_at!,
    });
    return;
  }
  if (existing) {
    await supabase.from('user_presence').update(patch).eq('user_id', userId);
  }
}

export async function fetchPresenceMap(userIds: string[]): Promise<Record<string, DbUserPresence>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase.from('user_presence').select('*').in('user_id', userIds);
  if (error || !data) return {};
  const m: Record<string, DbUserPresence> = {};
  for (const r of data as DbUserPresence[]) {
    m[r.user_id] = r;
  }
  return m;
}
