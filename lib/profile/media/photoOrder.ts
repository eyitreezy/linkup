import type { PrimaryPhotoRef } from '@/lib/profile/media/types';

/** Stable de-dupe for profile photo public URLs. */
export function uniquePhotoUrls(urls: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = typeof raw === 'string' ? raw.trim() : '';
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export function resolvePhotoUrl(
  ref: PrimaryPhotoRef,
  remoteUrls: string[],
  localUris: string[]
): string | null {
  if (ref.kind === 'remote') return ref.url;
  return localUris[ref.index] ?? null;
}

/** Primary first, then remaining photos (stable order). */
export function orderPhotoUrls(urls: string[], primaryUrl: string | null): string[] {
  if (!urls.length) return [];
  const primary = primaryUrl && urls.includes(primaryUrl) ? primaryUrl : urls[0];
  const rest = urls.filter((u) => u !== primary);
  return [primary, ...rest];
}

export type PhotoTileRef = { kind: 'remote' | 'local'; index: number; uri: string };

function matchesPrimaryRef(
  ref: PrimaryPhotoRef | null,
  kind: 'remote' | 'local',
  index: number,
  uri?: string
): boolean {
  if (!ref) return kind === 'remote' && index === 0;
  if (ref.kind === 'remote' && kind === 'remote') return ref.url === uri;
  if (ref.kind === 'local' && kind === 'local') return ref.index === index;
  return false;
}

/** Edit-profile gallery order: primary first, then remaining photos (stable). */
export function orderedPhotoTiles(
  remoteUrls: string[],
  localUris: string[],
  primaryRef: PrimaryPhotoRef | null
): PhotoTileRef[] {
  const tiles: PhotoTileRef[] = [
    ...remoteUrls.map((uri, index) => ({ kind: 'remote' as const, index, uri })),
    ...localUris.map((uri, index) => ({ kind: 'local' as const, index, uri })),
  ];
  if (tiles.length === 0) return tiles;

  const primaryIdx = tiles.findIndex((t) => matchesPrimaryRef(primaryRef, t.kind, t.index, t.uri));
  if (primaryIdx <= 0) return tiles;

  const primary = tiles[primaryIdx];
  const rest = tiles.filter((_, i) => i !== primaryIdx);
  return [primary, ...rest];
}

/** Profile preview: primary first, then remaining photos (remotes + locals). */
export function resolveDraftPhotoUrls(
  remoteUrls: string[],
  localUris: string[],
  primaryRef: PrimaryPhotoRef | null
): string[] {
  return orderedPhotoTiles(remoteUrls, localUris, primaryRef).map((t) => t.uri);
}

export function defaultPrimaryRef(remoteUrls: string[], localUris: string[]): PrimaryPhotoRef | null {
  if (remoteUrls[0]) return { kind: 'remote', url: remoteUrls[0] };
  if (localUris[0]) return { kind: 'local', index: 0 };
  return null;
}

export function primaryRefAfterRemove(
  ref: PrimaryPhotoRef | null,
  remoteUrls: string[],
  localUris: string[],
  removed: { kind: 'remote' | 'local'; index: number }
): PrimaryPhotoRef | null {
  if (!ref) return defaultPrimaryRef(remoteUrls, localUris);

  if (removed.kind === 'remote' && ref.kind === 'remote' && remoteUrls[removed.index] === ref.url) {
    return defaultPrimaryRef(remoteUrls, localUris);
  }
  if (removed.kind === 'local' && ref.kind === 'local' && ref.index === removed.index) {
    return defaultPrimaryRef(remoteUrls, localUris);
  }
  if (ref.kind === 'local' && removed.kind === 'local' && removed.index < ref.index) {
    return { kind: 'local', index: ref.index - 1 };
  }
  return ref;
}

export function buildProfilePhotoFields(args: {
  remoteUrls: string[];
  primaryRef: PrimaryPhotoRef | null;
}): { photo_urls: string[]; primary_photo_url: string | null; avatar_url: string | null } {
  let remoteUrls = uniquePhotoUrls(args.remoteUrls);
  let primaryUrl: string | null = null;

  if (args.primaryRef?.kind === 'remote') {
    primaryUrl = args.primaryRef.url;
    if (primaryUrl && !remoteUrls.includes(primaryUrl)) {
      remoteUrls = [primaryUrl, ...remoteUrls];
    }
  } else if (remoteUrls.length > 0) {
    primaryUrl = remoteUrls[0];
  }

  const photo_urls = orderPhotoUrls(remoteUrls, primaryUrl);
  const primary_photo_url = photo_urls[0] ?? null;
  const avatar_url = primary_photo_url;

  return { photo_urls, primary_photo_url, avatar_url };
}
