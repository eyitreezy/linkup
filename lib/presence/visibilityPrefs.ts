import type { DbProfile, ProfilePreferences } from '@/types/database';

export type VisibilityPrefs = NonNullable<ProfilePreferences['visibility']>;

export function defaultVisibilityPrefs(): Required<VisibilityPrefs> {
  return {
    show_online_status: true,
    show_last_seen: true,
    read_receipts: true,
    share_typing_indicator: true,
  };
}

export function getVisibilityPrefs(profile: DbProfile | null | undefined): Required<VisibilityPrefs> {
  const v = profile?.preferences?.visibility;
  const d = defaultVisibilityPrefs();
  return {
    show_online_status: v?.show_online_status !== false,
    show_last_seen: v?.show_last_seen !== false,
    read_receipts: v?.read_receipts !== false,
    share_typing_indicator: v?.share_typing_indicator !== false,
  };
}

/**
 * Fairness: if the viewer hides both online and last-seen sharing, they don’t see others’ activity.
 */
export function viewerMaySeeOthersPresence(profile: DbProfile | null | undefined): boolean {
  const v = getVisibilityPrefs(profile);
  return v.show_online_status || v.show_last_seen;
}

/** Reciprocal typing: both users must allow sharing typing indicators. */
export function typingVisibleToViewer(
  viewerProfile: DbProfile | null | undefined,
  subjectPreferences: ProfilePreferences | undefined
): boolean {
  const v = getVisibilityPrefs(viewerProfile);
  const s = getVisibilityPrefs({ preferences: subjectPreferences } as DbProfile);
  return v.share_typing_indicator && s.share_typing_indicator;
}
