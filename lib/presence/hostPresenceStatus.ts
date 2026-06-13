import {
  ONLINE_LAST_SEEN_MS,
  ONLINE_UPDATED_MS,
  RECENT_LAST_SEEN_MS,
} from '@/lib/presence/presenceConstants';
import { getVisibilityPrefs, viewerMaySeeOthersPresence } from '@/lib/presence/visibilityPrefs';
import type { DbProfile, DbUserPresence, ProfilePreferences } from '@/types/database';

export type PresenceUi = {
  dot: 'online' | 'recent' | 'offline' | null;
  caption: string | null;
};

export type HostPresenceFilter = 'all' | 'online' | 'offline';

export type HostPresenceKind = 'hidden' | 'online' | 'recent' | 'offline';

function subjectPrefs(prefs: ProfilePreferences | undefined) {
  return getVisibilityPrefs({ preferences: prefs } as DbProfile);
}

/** Resolve host presence for discover cards and filters (respects privacy + fairness rules). */
export function resolveHostPresenceKind(
  viewerProfile: DbProfile | null | undefined,
  subjectPreferences: ProfilePreferences | undefined,
  row: Pick<DbUserPresence, 'is_online' | 'last_seen' | 'updated_at'> | null | undefined,
  subjectMaskedActivity?: boolean
): HostPresenceKind {
  if (subjectMaskedActivity) return 'hidden';
  if (!viewerMaySeeOthersPresence(viewerProfile)) return 'hidden';
  const sub = subjectPrefs(subjectPreferences);
  if (!sub.show_online_status && !sub.show_last_seen) return 'hidden';
  if (!row) return 'hidden';

  const now = Date.now();
  const lastSeenMs = new Date(row.last_seen).getTime();
  const updatedMs = new Date(row.updated_at).getTime();
  if (!Number.isFinite(lastSeenMs)) return 'hidden';

  const freshLastSeen = now - lastSeenMs < ONLINE_LAST_SEEN_MS;
  const freshUpdated = Number.isFinite(updatedMs) && now - updatedMs < ONLINE_UPDATED_MS;
  const isOnline =
    sub.show_online_status && ((row.is_online && freshUpdated) || freshLastSeen);

  if (isOnline) return 'online';

  const withinRecent = now - lastSeenMs < RECENT_LAST_SEEN_MS;
  if (withinRecent && sub.show_last_seen) return 'recent';

  if (sub.show_online_status || sub.show_last_seen) return 'offline';

  return 'hidden';
}

export function presenceUiFromKind(kind: HostPresenceKind): PresenceUi {
  switch (kind) {
    case 'online':
      return { dot: 'online', caption: 'Online' };
    case 'recent':
      return { dot: 'recent', caption: 'Active recently' };
    case 'offline':
      return { dot: 'offline', caption: 'Offline' };
    default:
      return { dot: null, caption: null };
  }
}

export function derivePresenceUi(
  viewerProfile: DbProfile | null | undefined,
  subjectPreferences: ProfilePreferences | undefined,
  row: Pick<DbUserPresence, 'is_online' | 'last_seen' | 'updated_at'> | null | undefined,
  subjectMaskedActivity?: boolean
): PresenceUi {
  return presenceUiFromKind(
    resolveHostPresenceKind(viewerProfile, subjectPreferences, row, subjectMaskedActivity)
  );
}

export function hostPresenceMatchesFilter(kind: HostPresenceKind, filter: HostPresenceFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'online') return kind === 'online' || kind === 'recent';
  return kind === 'offline';
}
