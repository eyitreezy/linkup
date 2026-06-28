import type { ImageSourcePropType } from 'react-native';

/**
 * Catalog meet-type Meetr tiles — bundled from `assets/meetr-images/`.
 * Keep filenames in sync with linkup-web/public/meetr-images/.
 */
const MEETR_CATALOG_COVERS = {
  dinner: require('@/assets/meetr-images/dinner.jpg'),
  gym: require('@/assets/meetr-images/gym.jpg'),
  mood: require('@/assets/meetr-images/mood.jpg'),
  casual: require('@/assets/meetr-images/casual.jpg'),
  hangout: require('@/assets/meetr-images/hangout.jpg'),
  group: require('@/assets/meetr-images/group.jpg'),
  default: require('@/assets/meetr-images/default.jpg'),
} as const satisfies Record<string, ImageSourcePropType>;

export function meetTypeCatalogCoverSource(slug: string): ImageSourcePropType {
  return MEETR_CATALOG_COVERS[slug as keyof typeof MEETR_CATALOG_COVERS] ?? MEETR_CATALOG_COVERS.default;
}
