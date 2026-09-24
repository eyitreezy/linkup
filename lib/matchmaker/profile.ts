import { fetchProfileVideo, type ProfileVideoRecord } from '@/lib/profile/media/profileVideo';
import type { MatchMakerPoolProfile } from '@/lib/matchmaker/types';
import { supabase } from '@/lib/supabase';
import type { DbProfile, ProfilePreferences } from '@/types/database';

export type MatchMakerProfileBundle = {
  profile: DbProfile;
  video: ProfileVideoRecord | null;
  poolProfile: MatchMakerPoolProfile;
};

function interestsFromPreferences(preferences: ProfilePreferences | null | undefined): string[] {
  const raw = preferences?.interests;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export function mapDbProfileToPoolProfile(
  profile: DbProfile,
  options?: { distanceKm?: number | null }
): MatchMakerPoolProfile {
  const photoUrls = profile.photo_urls ?? [];
  const avatar =
    profile.avatar_url ??
    profile.primary_photo_url ??
    (photoUrls.length > 0 ? photoUrls[0] : null);

  return {
    user_id: profile.user_id,
    display_name: profile.display_name ?? null,
    birth_date: profile.birth_date ?? null,
    avatar_url: avatar,
    location_label: profile.location_label ?? null,
    verified_badge: Boolean(profile.verified_badge),
    bio: profile.bio ?? null,
    interests: interestsFromPreferences(profile.preferences),
    communication_style: profile.communication_style ?? null,
    distance_km:
      options?.distanceKm != null && Number.isFinite(options.distanceKm)
        ? options.distanceKm
        : null,
  };
}

/** Full MatchMaker profile — photos, video, prompts (same sources as Discover). */
export async function fetchMatchMakerProfileBundle(
  userId: string,
  options?: { distanceKm?: number | null }
): Promise<MatchMakerProfileBundle> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Profile not found');

  const profile = data as DbProfile;
  const video = await fetchProfileVideo(userId);

  return {
    profile,
    video,
    poolProfile: mapDbProfileToPoolProfile(profile, options),
  };
}
