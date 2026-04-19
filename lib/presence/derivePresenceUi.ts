import {
  ONLINE_LAST_SEEN_MS,
  ONLINE_UPDATED_MS,
  RECENT_LAST_SEEN_MS,
} from '@/lib/presence/presenceConstants';
import { getVisibilityPrefs, viewerMaySeeOthersPresence } from '@/lib/presence/visibilityPrefs';
import type { DbProfile, DbUserPresence, ProfilePreferences } from '@/types/database';

export type PresenceUi = {
  dot: 'online' | 'recent' | null;
  caption: string | null;
};

function subjectPrefs(prefs: ProfilePreferences | undefined) {
  return getVisibilityPrefs({ preferences: prefs } as DbProfile);
}

/**
 * Map raw presence + privacy prefs to UI (no exact timestamps).
 */
export function derivePresenceUi(
  viewerProfile: DbProfile | null | undefined,
  subjectPreferences: ProfilePreferences | undefined,
  row: Pick<DbUserPresence, 'is_online' | 'last_seen' | 'updated_at'> | null | undefined
): PresenceUi {
  if (!viewerMaySeeOthersPresence(viewerProfile)) {
    return { dot: null, caption: null };
  }
  const sub = subjectPrefs(subjectPreferences);
  if (!sub.show_online_status && !sub.show_last_seen) {
    return { dot: null, caption: null };
  }
  if (!row) {
    return { dot: null, caption: null };
  }

  const now = Date.now();
  const lastSeenMs = new Date(row.last_seen).getTime();
  const updatedMs = new Date(row.updated_at).getTime();
  if (!Number.isFinite(lastSeenMs)) {
    return { dot: null, caption: null };
  }

  const freshLastSeen = now - lastSeenMs < ONLINE_LAST_SEEN_MS;
  const freshUpdated = Number.isFinite(updatedMs) && now - updatedMs < ONLINE_UPDATED_MS;
  const isOnline =
    sub.show_online_status && ((row.is_online && freshUpdated) || freshLastSeen);

  if (isOnline) {
    return { dot: 'online', caption: 'Online' };
  }

  const withinRecent = now - lastSeenMs < RECENT_LAST_SEEN_MS;
  if (withinRecent && sub.show_last_seen) {
    return { dot: 'recent', caption: 'Active recently' };
  }

  return { dot: null, caption: null };
}
