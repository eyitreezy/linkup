export type MediaType = 'image' | 'video';

export function mediaTypeFromMime(mime: string | null | undefined): MediaType {
  return mime?.startsWith('video/') ? 'video' : 'image';
}
