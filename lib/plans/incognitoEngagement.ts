import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type ViewerPrivacyPrefs = {
  incognito_browse_enabled: boolean;
  profile_view_privacy_enabled: boolean;
};

export async function fetchViewerPrivacyPrefs(
  client: SupabaseClient,
  userId: string
): Promise<ViewerPrivacyPrefs> {
  const { data } = await client
    .from('profiles')
    .select('incognito_browse_enabled, profile_view_privacy_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    incognito_browse_enabled: !!data?.incognito_browse_enabled,
    profile_view_privacy_enabled: !!data?.profile_view_privacy_enabled,
  };
}

export function shouldSkipPlanViewRecording(prefs: ViewerPrivacyPrefs): boolean {
  return prefs.incognito_browse_enabled;
}

export function shouldSkipProfileViewRecording(prefs: ViewerPrivacyPrefs): boolean {
  return prefs.incognito_browse_enabled || prefs.profile_view_privacy_enabled;
}

/** Returns user IDs that should be hidden from host interest surfaces. */
export async function fetchIncognitoUserIds(userIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .in('user_id', unique)
    .eq('incognito_browse_enabled', true);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

export function filterEngagementsByIncognito<T extends { user_id: string }>(
  rows: T[],
  incognitoIds: Set<string>
): T[] {
  if (incognitoIds.size === 0) return rows;
  return rows.filter((r) => !incognitoIds.has(r.user_id));
}
