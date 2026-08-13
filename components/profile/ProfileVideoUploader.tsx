import { authSoftLabelStyle } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { ProfileVideoPreviewModal } from '@/components/profile/ProfileVideoPreviewModal';
import { ProfileVideoTileThumbnail } from '@/components/profile/ProfileVideoTileThumbnail';
import { AppFeedbackModal } from '@/components/ui/AppFeedbackModal';
import { colors, radius, fonts } from '@/constants/theme';
import { probeProfileVideoDurationSeconds } from '@/lib/profile/media/probeProfileVideoDuration';
import {
  PROFILE_VIDEO_MAX_COUNT,
  PROFILE_VIDEO_MAX_DURATION_SECONDS,
  PROFILE_VIDEO_MAX_SIZE_LABEL,
  formatProfileVideoSlotError,
  validateProfileVideoDuration,
  validateProfileVideoTypeAndSize,
} from '@/lib/profile/media/videoLimits';
import type { OnboardingVideoSlot } from '@/types/onboarding';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ADD_TILE_GRADIENT = [colors.primary, '#8B7CE8', colors.secondary] as const;

const TILE_W = 108;
const TILE_H = 132;

type Props = {
  videos: OnboardingVideoSlot[];
  onAddVideo: (localUri: string, mimeType: string) => void;
  onRemoveVideo: (index: number) => void;
  onPickSuccess?: () => void;
  required?: boolean;
  highlightError?: string | null;
};

export function ProfileVideoUploader({
  videos,
  onAddVideo,
  onRemoveVideo,
  onPickSuccess,
  required,
  highlightError,
}: Props) {
  const [picking, setPicking] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const canAdd = videos.length < PROFILE_VIDEO_MAX_COUNT;

  const previewUri =
    previewIndex != null
      ? videos[previewIndex]?.localUri ?? videos[previewIndex]?.remoteUrl ?? null
      : null;

  async function pick() {
    if (!canAdd) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos access needed', 'Allow photo library access to upload a video.');
      return;
    }
    setPicking(true);
    setPickError(null);
    const slotIndex = videos.length;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: PROFILE_VIDEO_MAX_DURATION_SECONDS,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      const typeAndSize = validateProfileVideoTypeAndSize({
        size: asset.fileSize ?? undefined,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri,
      });
      if (!typeAndSize.valid) {
        setPickError(formatProfileVideoSlotError(slotIndex, typeAndSize.error ?? 'Invalid video.'));
        return;
      }

      const probedDuration = await probeProfileVideoDurationSeconds(asset.uri);
      const durationCheck = validateProfileVideoDuration(probedDuration);
      if (!durationCheck.valid) {
        setPickError(formatProfileVideoSlotError(slotIndex, durationCheck.error ?? 'Invalid video.'));
        return;
      }

      onAddVideo(asset.uri, asset.mimeType ?? 'video/mp4');
      onPickSuccess?.();
    } finally {
      setPicking(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[authSoftLabelStyle, styles.labelSpacing]}>
        Videos{required ? ' *' : ''}
      </Text>
      <Text style={styles.hint}>
        Up to {PROFILE_VIDEO_MAX_COUNT} clips, max {PROFILE_VIDEO_MAX_DURATION_SECONDS}s and{' '}
        {PROFILE_VIDEO_MAX_SIZE_LABEL} each. Tap a clip to preview.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {videos.map((slot, i) => {
          const tileUri = slot.localUri ?? slot.remoteUrl ?? undefined;
          return (
            <MotiView
              key={`${slot.mediaId ?? 'local'}-${i}`}
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <View style={styles.tileWrap}>
                <Pressable
                  onPress={() => tileUri && setPreviewIndex(i)}
                  disabled={!tileUri}
                  style={({ pressed }) => [pressed && tileUri && styles.tilePressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview video ${i + 1}`}
                >
                  {tileUri ? (
                    <View style={styles.tileMedia}>
                      <ProfileVideoTileThumbnail
                        uri={tileUri}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={styles.playOverlay} pointerEvents="none">
                        <View style={styles.playCircle}>
                          <Ionicons name="play" size={18} color="#fff" style={styles.playIcon} />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.tileMedia, styles.tileEmpty]}>
                      <Ionicons name="videocam-outline" size={22} color={colors.textMuted} />
                    </View>
                  )}
                </Pressable>
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeTxt}>{i + 1}</Text>
                </View>
                <Pressable
                  style={styles.remove}
                  onPress={() => onRemoveVideo(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove video ${i + 1}`}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </Pressable>
              </View>
            </MotiView>
          );
        })}

        {canAdd ? (
          <Pressable
            onPress={() => void pick()}
            disabled={picking}
            style={({ pressed }) => [
              styles.addTileOuter,
              pressed && !picking && styles.addTilePressed,
              picking && styles.addTileDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add profile video"
          >
            <LinearGradient
              colors={[...ADD_TILE_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addTile}
            >
              {picking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={videos.length === 0 ? 'videocam-outline' : 'add'}
                    size={videos.length === 0 ? 28 : 36}
                    color="#FFFFFF"
                  />
                  <Text style={styles.addLabel}>
                    {videos.length === 0 ? 'Add video' : 'Add another'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        ) : null}
      </ScrollView>

      {highlightError ? <Text style={styles.errorText}>{highlightError}</Text> : null}
      {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}

      <ProfileVideoPreviewModal
        visible={previewIndex != null && !!previewUri}
        uri={previewUri}
        slotIndex={previewIndex ?? 0}
        slotTotal={videos.length}
        onClose={() => setPreviewIndex(null)}
      />

      <AppFeedbackModal
        visible={pickError != null}
        onClose={() => setPickError(null)}
        variant="error"
        kicker="Video not allowed"
        title="Could not add this clip"
        message={pickError ?? ''}
        primaryLabel="Choose another"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: onboarding.spacing.lg },
  labelSpacing: { marginBottom: 4 },
  hint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: onboarding.muted,
    marginBottom: onboarding.spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  tileWrap: { position: 'relative' },
  tilePressed: { opacity: 0.92 },
  tileMedia: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: onboarding.radius2xl,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#D8DCE6',
    overflow: 'hidden',
    position: 'relative',
  },
  tileEmpty: {
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(94, 82, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  playIcon: { marginLeft: 2 },
  slotBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.button,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  slotBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.button,
    zIndex: 2,
  },
  addTileOuter: {
    borderRadius: onboarding.radius2xl,
    overflow: 'hidden',
  },
  addTilePressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  addTileDisabled: { opacity: 0.4 },
  addTile: {
    width: TILE_W,
    height: TILE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.danger,
    marginTop: 6,
    lineHeight: 18,
  },
});
