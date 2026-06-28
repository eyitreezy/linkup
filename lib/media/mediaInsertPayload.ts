import { mediaTypeFromMime } from '@/lib/media/mediaType';

export type MediaInsertPayload = {
  parent_table: string;
  parent_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  media_type: 'image' | 'video';
  media_url?: string | null;
  metadata?: Record<string, unknown>;
  created_by: string;
};

/** Required fields for `public.media` rows (includes NOT NULL `media_type`). */
export function buildMediaInsertPayload(
  args: Omit<MediaInsertPayload, 'media_type'> & { mime_type: string }
): MediaInsertPayload {
  return {
    ...args,
    media_type: mediaTypeFromMime(args.mime_type),
  };
}
