import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbMeetType } from '@/types/database';

let cache: DbMeetType[] | null = null;
let cacheAt = 0;
const TTL_MS = 60_000;

export async function fetchActiveMeetTypes(): Promise<{ rows: DbMeetType[]; error: string | null }> {
  if (!isSupabaseConfigured) return { rows: [], error: 'Not configured' };
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return { rows: cache, error: null };

  const { data, error } = await supabase
    .from('meet_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { rows: [], error: error.message };
  cache = (data ?? []) as DbMeetType[];
  cacheAt = now;
  return { rows: cache, error: null };
}

export function invalidateMeetTypesCache(): void {
  cache = null;
  cacheAt = 0;
}
