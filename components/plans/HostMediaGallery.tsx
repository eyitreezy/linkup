/**
 * Full-width host media carousel — Tinder / Bumble / Hinge style.
 */
import { HostMediaCarousel } from '@/components/plans/HostMediaCarousel';
import { radius } from '@/constants/theme';
import type { HostMediaItem } from '@/lib/profile/media/buildHostMediaSequence';
import { MotiView } from 'moti';
import { StyleSheet, useWindowDimensions } from 'react-native';

const GALLERY_ASPECT = 1.12;

type Props = {
  items: HostMediaItem[];
  loading?: boolean;
  /** Full-bleed below screen header (no side radius). */
  edgeToEdge?: boolean;
};

export function HostMediaGallery({ items, loading, edgeToEdge }: Props) {
  const { width } = useWindowDimensions();
  const slideHeight = Math.round(width * GALLERY_ASPECT);
  const shellStyle = [styles.shell, edgeToEdge && styles.shellEdge, { height: slideHeight }];

  if (!loading && items.length === 0) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320 }}
      style={shellStyle}
    >
      <HostMediaCarousel
        items={items}
        width={width}
        height={slideHeight}
        loading={loading}
        showCounter
        interactive
      />
    </MotiView>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginBottom: 12,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  shellEdge: {
    borderRadius: 0,
    marginBottom: 0,
  },
});
