import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbProfile } from '@/types/database';

const seedByUserId = new Map<string, DbProfile>();
const inflightPrefetch = new Map<string, Promise<void>>();

function profileShell(userId: string): DbProfile {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    display_name: null,
    bio: null,
    avatar_url: null,
    preferences: {},
    age_min: null,
    age_max: null,
    radius_km: null,
    latitude: null,
    longitude: null,
    location_label: null,
    is_profile_public: true,
    ai_trust_score: null,
    verified_badge: false,
    created_at: now,
    updated_at: now,
  };
}

/** Seed from meetup details, discover card, or any partial profile slice. */
export function seedPublicProfile(
  userId: string,
  partial?: Partial<DbProfile> | null
): void {
  if (!userId) return;
  const existing = seedByUserId.get(userId);
  seedByUserId.set(userId, {
    ...profileShell(userId),
    ...existing,
    ...partial,
    user_id: userId,
    preferences: { ...existing?.preferences, ...partial?.preferences },
  });
}

export function peekPublicProfileSeed(userId: string): DbProfile | null {
  return seedByUserId.get(userId) ?? null;
}

export function warmPublicProfileNavigation(
  userId: string,
  partial?: Partial<DbProfile> | null
): void {
  if (!userId) return;
  if (partial) seedPublicProfile(userId, partial);
  prefetchPublicProfile(userId);
}

export function prefetchPublicProfile(userId: string): void {
  if (!userId || !isSupabaseConfigured || inflightPrefetch.has(userId)) return;
  const run = (async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (data) seedPublicProfile(userId, data as DbProfile);
    } finally {
      inflightPrefetch.delete(userId);
    }
  })();
  inflightPrefetch.set(userId, run);
}
