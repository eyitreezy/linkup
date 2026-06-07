import { KycLivenessVideoPreview } from '@/components/kyc/KycLivenessVideoPreview';
import { colors, radius, spacing } from '@/constants/theme';
import { resolveOrderedProfilePhotos } from '@/lib/profile/displayMedia';
import type { DbProfile } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  profile: DbProfile;
  videoUrl?: string | null;
};

/** Read-only gallery: primary → photos → video. */
export function ProfileMediaGallery({ profile, videoUrl }: Props) {
  const photos = resolveOrderedProfilePhotos(profile);

  if (photos.length === 0 && !videoUrl) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photos & video</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((uri, i) => (
          <View key={`${uri}-${i}`} style={styles.tileWrap}>
            <Image source={{ uri }} style={styles.photo} />
            {i === 0 ? (
              <View style={styles.primaryPill}>
                <Ionicons name="star" size={10} color="#fff" />
                <Text style={styles.primaryTxt}>Primary</Text>
              </View>
            ) : null}
          </View>
        ))}
        {videoUrl ? (
          <View style={styles.videoTile}>
            <KycLivenessVideoPreview uri={videoUrl} style={styles.video} mirror={false} />
            <View style={styles.videoBadge}>
              <Ionicons name="play-circle" size={12} color="#fff" />
              <Text style={styles.videoBadgeTxt}>Intro</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  label: { fontSize: 11, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8 },
  row: { gap: 10, paddingVertical: 4 },
  tileWrap: { position: 'relative' },
  photo: { width: 120, height: 150, borderRadius: radius.lg, backgroundColor: '#eee' },
  primaryPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  primaryTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },
  videoTile: { width: 120, height: 150, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#0F172A' },
  video: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,101,132,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  videoBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },
});
