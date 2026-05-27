import type { SupabaseClient } from '@supabase/supabase-js';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { invalidateMeetTypesCache } from '@/lib/plans/meetTypes';
import type { DbMeetType } from '@/types/database';

function slugBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'meetup';
}

/**
 * Inserts a user-owned meet type (requires `meet_types_insert_user` RLS policy).
 */
export async function insertUserMeetType(
  client: SupabaseClient,
  userId: string,
  name: string
): Promise<{ row: DbMeetType | null; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { row: null, error: 'Enter a name for your meet type.' };

  const base = slugBase(trimmed);
  const entropy = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `u-${base}-${entropy}`;

  const icon = inferMeetTypeIcon(trimmed) as string;

  const { data, error } = await client
    .from('meet_types')
    .insert({
      name: trimmed,
      slug,
      default_duration_minutes: 120,
      allows_escrow: true,
      allowed_patterns: ['A', 'B', 'C'],
      default_pattern: 'A',
      is_restricted: false,
      supports_mood: false,
      icon,
      sort_order: 9000,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  invalidateMeetTypesCache();
  return { row: data as DbMeetType, error: null };
}
