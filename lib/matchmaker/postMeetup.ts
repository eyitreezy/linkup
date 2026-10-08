import type { SupabaseClient } from '@supabase/supabase-js';

export type PostMeetupFeeling =
  | 'much_stronger'
  | 'stronger'
  | 'same'
  | 'weaker'
  | 'not_sure';

const FEELING_OPTIONS: { id: PostMeetupFeeling; label: string }[] = [
  { id: 'much_stronger', label: 'Much stronger' },
  { id: 'stronger', label: 'Stronger' },
  { id: 'same', label: 'Same' },
  { id: 'weaker', label: 'Weaker' },
  { id: 'not_sure', label: 'Not sure yet' },
];

export { FEELING_OPTIONS };

export async function fetchPostMeetupReflectionDone(
  client: SupabaseClient,
  connectionId: string,
  userId: string
): Promise<boolean> {
  const { data } = await client
    .from('matchmaker_reflection_responses')
    .select('id, post_meetup_feeling, post_meetup_quality')
    .eq('connection_id', connectionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return false;
  return data.post_meetup_feeling != null || data.post_meetup_quality != null;
}

export async function savePostMeetupReflection(
  client: SupabaseClient,
  connectionId: string,
  userId: string,
  feeling: PostMeetupFeeling | null,
  quality: string | null
): Promise<{ error: string | null }> {
  const { error } = await client.from('matchmaker_reflection_responses').upsert(
    {
      connection_id: connectionId,
      user_id: userId,
      post_meetup_feeling: feeling,
      post_meetup_quality: quality,
    },
    { onConflict: 'connection_id,user_id' }
  );
  return { error: error?.message ?? null };
}

export async function markPostMeetupSkipped(
  client: SupabaseClient,
  connectionId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await client.from('matchmaker_reflection_responses').upsert(
    {
      connection_id: connectionId,
      user_id: userId,
      post_meetup_feeling: 'skipped',
      post_meetup_quality: null,
    },
    { onConflict: 'connection_id,user_id' }
  );
  return { error: error?.message ?? null };
}
