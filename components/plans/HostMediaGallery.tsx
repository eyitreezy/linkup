/**
 * Full-width host media carousel — Tinder / Bumble / Hinge style.
 */
import { colors, radius } from '@/constants/theme';
import type { HostMediaItem } from '@/lib/profile/media/buildHostMediaSequence';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MotiView } from 'moti';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const GALLERY_ASPECT = 1.12;

type Props = {
  items: HostMediaItem[];
  loading?: boolean;
  /** Full-bleed below screen header (no side radius). */
  edgeToEdge?: boolean;
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 'Video';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function HostMediaVideoSlide({ uri, active }: { uri: string; active: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && player.duration > 0) {
      setDurationSec(player.duration);
    }
    if (status === 'idle') {
      setPlaying(false);
      if (player.duration > 0 && player.currentTime >= player.duration - 0.25) {
        setEnded(true);
      }
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    setPlaying(isPlaying);
    if (isPlaying) setEnded(false);
  });

  useEffect(() => {
    if (!active) {
      player.pause();
      setPlaying(false);
      setEnded(false);
    }
  }, [active, player]);

  function togglePlay() {
    if (playing) {
      player.pause();
      return;
    }
    player.muted = muted;
    const atEnd = player.duration > 0 && player.currentTime >= player.duration - 0.25;
    if (atEnd) {
      player.currentTime = 0;
    }
    player.play();
  }

  return (
    <View style={styles.slide}>
      <VideoView player={player} style={styles.media} contentFit="cover" nativeControls={false} />
      <View style={styles.videoOverlay}>
        <Pressable style={styles.videoPlayBtn} onPress={togglePlay} accessibilityRole="button">
          <Ionicons name={playing ? 'pause' : ended ? 'refresh' : 'play'} size={28} color="#fff" />
        </Pressable>
        <View style={styles.videoMetaRow}>
          <Text style={styles.videoDuration}>{formatDuration(durationSec)}</Text>
          <Pressable
            onPress={() => {
              const next = !muted;
              setMuted(next);
              player.muted = next;
            }}
            style={styles.muteBtn}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HostMediaPhotoSlide({ uri }: { uri: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.slide}>
      {loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={styles.media}
        contentFit="cover"
        transition={220}
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
}

export function HostMediaGallery({ items, loading, edgeToEdge }: Props) {
  const { width } = useWindowDimensions();
  const slideWidth = width;
  const slideHeight = Math.round(width * GALLERY_ASPECT);
  const listRef = useRef<FlatList<HostMediaItem>>(null);
  const [index, setIndex] = useState(0);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / slideWidth);
      if (next !== index) setIndex(next);
    },
    [index, slideWidth]
  );

  const goTo = useCallback(
    (next: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(next, items.length - 1));
      listRef.current?.scrollToOffset({ offset: clamped * slideWidth, animated: true });
      setIndex(clamped);
    },
    [items.length, slideWidth]
  );

  const renderItem = useCallback(
    ({ item, index: i }: ListRenderItemInfo<HostMediaItem>) => (
      <View style={{ width: slideWidth, height: slideHeight }}>
        {item.kind === 'photo' ? (
          <HostMediaPhotoSlide uri={item.url} />
        ) : (
          <HostMediaVideoSlide uri={item.url} active={i === index} />
        )}
      </View>
    ),
    [slideWidth, slideHeight, index]
  );

  const shellStyle = [styles.shell, edgeToEdge && styles.shellEdge, { height: slideHeight }];

  if (loading) {
    return (
      <View style={shellStyle}>
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingTxt}>Loading host photos…</Text>
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320 }}
      style={shellStyle}
    >
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, i) => `${item.kind}-${item.url}-${i}`}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={onScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: slideWidth, offset: slideWidth * i, index: i })}
        bounces={items.length > 1}
        decelerationRate="fast"
      />

      <View style={styles.progressRow} pointerEvents="none">
        {items.map((item, i) => (
          <View
            key={`dot-${i}`}
            style={[
              styles.progressSeg,
              i === index && styles.progressSegActive,
              item.kind === 'video' && styles.progressSegVideo,
            ]}
          />
        ))}
      </View>

      <Text style={styles.counter} pointerEvents="none">
        {index + 1} / {items.length}
        {items[index]?.kind === 'video' ? ' · Intro' : ''}
      </Text>

      {items.length > 1 ? (
        <>
          <Pressable
            style={styles.tapLeft}
            onPress={() => goTo(index - 1)}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
          />
          <Pressable
            style={styles.tapRight}
            onPress={() => goTo(index + 1)}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
          />
        </>
      ) : null}

      <LinearGradientEdge />
    </MotiView>
  );
}

function LinearGradientEdge() {
  return <View style={styles.bottomFade} pointerEvents="none" />;
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
  slide: { flex: 1, backgroundColor: '#0F172A' },
  media: { width: '100%', height: '100%' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(237,232,255,0.5)',
    gap: 8,
  },
  loadingTxt: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  progressRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 4,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressSegActive: {
    backgroundColor: '#fff',
  },
  progressSegVideo: {
    backgroundColor: 'rgba(255,101,132,0.55)',
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(15,23,42,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
    overflow: 'hidden',
    zIndex: 4,
  },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '32%',
    zIndex: 3,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '32%',
    zIndex: 3,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  videoPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108,99,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  videoMetaRow: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoDuration: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: 'rgba(15,23,42,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  muteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    backgroundColor: 'transparent',
  },
});
