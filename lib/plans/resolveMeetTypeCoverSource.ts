import { meetTypeCatalogCoverSource } from '@/lib/plans/meetTypeCatalogCovers';
import type { DbMeetType } from '@/types/database';
import type { ImageSourcePropType } from 'react-native';

/** Prefer Storage URL (`meet_type_images`); fall back to bundled catalog cover by slug. */
export function resolveMeetTypeCoverSource(type: DbMeetType): ImageSourcePropType {
  if (type.meet_type_images) {
    return { uri: type.meet_type_images };
  }
  return meetTypeCatalogCoverSource(type.slug);
}
