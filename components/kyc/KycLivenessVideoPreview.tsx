/**
 * Playback for KYC selfie clips — native controls, mirrored preview for front-camera recordings.
 */
import { colors, radius } from '@/constants/theme';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';

type Props = {
  uri: string;
  style?: ViewStyle;
  /** Match front-camera selfie orientation in preview. */
  mirror?: boolean;
};

export function KycLivenessVideoPreview({ uri, style, mirror = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') setLoading(false);
    if (status === 'error') {
      setLoading(false);
      setError(true);
    }
  });

  if (error) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackTxt}>Could not play this clip. Tap Re-record to try again.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
      <VideoView
        player={player}
        style={[styles.video, mirror && styles.mirror]}
        nativeControls
        contentFit="cover"
        fullscreenOptions={{ enable: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0f1118',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  video: { flex: 1, width: '100%' },
  mirror: { transform: [{ scaleX: -1 }] },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,17,24,0.55)',
    zIndex: 2,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#1A1D26',
  },
  fallbackTxt: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
