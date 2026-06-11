import { supabase } from '@/lib/supabase';

export type ForwardTarget = {
  conversationId: string;
  otherUserId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

/** Conversations the user can forward a message into (excludes current thread). */
export async function fetchForwardTargets(
  userId: string,
  excludeConversationId?: string
): Promise<ForwardTarget[]> {
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, user_a, user_b')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (error || !convs?.length) return [];

  const filtered = excludeConversationId
    ? convs.filter((c) => c.id !== excludeConversationId)
    : convs;
  if (filtered.length === 0) return [];

  const otherIds = [
    ...new Set(filtered.map((c) => (c.user_a === userId ? c.user_b : c.user_a))),
  ];

  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, verified_badge')
    .in('user_id', otherIds);

  const profByUser = new Map((profs ?? []).map((p) => [p.user_id as string, p]));

  return filtered
    .map((c) => {
      const otherUserId = c.user_a === userId ? c.user_b : c.user_a;
      const prof = profByUser.get(otherUserId);
      return {
        conversationId: c.id,
        otherUserId,
        name: (prof?.display_name as string | undefined) ?? 'Member',
        avatarUrl: (prof?.avatar_url as string | null | undefined) ?? null,
        verified: !!prof?.verified_badge,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
