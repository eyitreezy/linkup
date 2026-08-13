import { colors, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
};

export function ProfileVideoTileThumbnail({ uri, style }: Props) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setFailed(false);
    setThumbUri(null);

    void (async () => {
      try {
        const { uri: generated } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 0,
          quality: 0.72,
        });
        if (cancelled) return;
        setThumbUri(generated);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (loading) {
    return (
      <View style={[styles.fallback, style]}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (failed || !thumbUri) {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name="videocam-outline" size={22} color={colors.textMuted} />
        <Text style={styles.fallbackTxt}>Video</Text>
      </View>
    );
  }

  return (
    <View style={[styles.imageWrap, style]}>
      <Image source={{ uri: thumbUri }} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    gap: 4,
  },
  fallbackTxt: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
});
