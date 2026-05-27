import { supabase } from '@/lib/supabase';
import type { DbProfile } from '@/types/database';
import type { Href } from 'expo-router';

/** Discover feed (main tabs index). */
export const DISCOVER_ROUTE = '/(tabs)' as Href;

export const ONBOARDING_ROUTE = '/onboarding' as Href;

export function needsOnboarding(profile: DbProfile | null | undefined): boolean {
  return !profile || profile.onboarding_status === 'pending';
}

export function postAuthHref(profile: DbProfile | null | undefined): Href {
  return (needsOnboarding(profile) ? ONBOARDING_ROUTE : DISCOVER_ROUTE) as Href;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Load profile row for routing (retries while `handle_new_user` trigger finishes). */
export async function fetchProfileForPostAuth(
  userId: string,
  maxAttempts = 8
): Promise<DbProfile | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error && __DEV__) console.warn('[postAuth] profile fetch:', error.message);
    if (data) return data as DbProfile;
    await sleep(150 + i * 100);
  }
  return null;
}

/** Resolve Discover vs onboarding after session is established. */
export async function resolvePostAuthHref(userId: string): Promise<Href> {
  const profile = await fetchProfileForPostAuth(userId);
  return postAuthHref(profile);
}
