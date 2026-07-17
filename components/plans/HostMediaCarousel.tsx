/**
 * Tinder-style host media carousel — tap left/right, optional center press.
 * Used on profile galleries and full-bleed discovery swipe cards.
 */
import { colors, radius, fonts } from '@/constants/theme';
import type { HostMediaItem } from '@/lib/profile/media/buildHostMediaSequence';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

export type HostMediaCarouselProps = {
  items: HostMediaItem[];
  width: number;
  height: number;
  loading?: boolean;
  /** Opens plan / profile when user taps the center zone. */
  onCenterPress?: () => void;
  showCounter?: boolean;
  /** First slide only, no gestures (deck card behind the active card). */
  previewOnly?: boolean;
  interactive?: boolean;
  /** Light haptic when the active slide changes (discover swipe card). */
  slideHaptics?: boolean;
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 'Video';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function HostMediaVideoSlideShell({
  active,
  durationLabel,
  playing,
  ended,
  muted,
  onTogglePlay,
  onToggleMute,
  children,
}: {
  active: boolean;
  durationLabel: string;
  playing: boolean;
  ended: boolean;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.slide}>
      {active ? children : <View style={[styles.media, styles.inactiveVideoPoster]} />}
      <View style={styles.videoOverlay}>
        <Pressable style={styles.videoPlayBtn} onPress={onTogglePlay} accessibilityRole="button">
          <Ionicons name={playing ? 'pause' : ended ? 'refresh' : 'play'} size={28} color="#fff" />
        </Pressable>
        <View style={styles.videoMetaRow}>
          <Text style={styles.videoDuration}>{durationLabel}</Text>
          {active ? (
            <Pressable
              onPress={onToggleMute}
              style={styles.muteBtn}
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
            >
              <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function HostMediaVideoSlidePlayer({ uri }: { uri: string }) {
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
    <HostMediaVideoSlideShell
      active
      durationLabel={formatDuration(durationSec)}
      playing={playing}
      ended={ended}
      muted={muted}
      onTogglePlay={togglePlay}
      onToggleMute={() => {
        const next = !muted;
        setMuted(next);
        player.muted = next;
      }}
    >
      <VideoView player={player} style={styles.media} contentFit="cover" nativeControls={false} />
    </HostMediaVideoSlideShell>
  );
}

function HostMediaVideoSlide({ uri, active }: { uri: string; active: boolean }) {
  if (!active) {
    return (
      <HostMediaVideoSlideShell
        active={false}
        durationLabel="Video"
        playing={false}
        ended={false}
        muted
        onTogglePlay={() => {}}
        onToggleMute={() => {}}
      />
    );
  }

  return <HostMediaVideoSlidePlayer key={uri} uri={uri} />;
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
        cachePolicy="memory-disk"
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
}

export function HostMediaCarousel({
  items,
  width,
  height,
  loading,
  onCenterPress,
  showCounter = true,
  previewOnly = false,
  interactive = true,
  slideHaptics = false,
}: HostMediaCarouselProps) {
  const listRef = useRef<FlatList<HostMediaItem>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!slideHaptics || previewOnly) return;
    if (indexRef.current === index) return;
    indexRef.current = index;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [index, slideHaptics, previewOnly]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / width);
      if (next !== index) setIndex(next);
    },
    [index, width]
  );

  const goTo = useCallback(
    (next: number) => {
      if (items.length === 0 || width <= 0) return;
      const clamped = Math.max(0, Math.min(next, items.length - 1));
      listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
      setIndex(clamped);
    },
    [items.length, width]
  );

  const renderItem = useCallback(
    ({ item, index: i }: ListRenderItemInfo<HostMediaItem>) => (
      <View style={{ width, height }}>
        {item.kind === 'photo' ? (
          <HostMediaPhotoSlide uri={item.url} />
        ) : (
          <HostMediaVideoSlide uri={item.url} active={i === index} />
        )}
      </View>
    ),
    [width, height, index]
  );

  if (loading) {
    return (
      <View style={[styles.shell, { width, height }]}>
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingTxt}>Loading host photos…</Text>
        </View>
      </View>
    );
  }

  if (items.length === 0 || width <= 0 || height <= 0) {
    return (
      <View style={[styles.shell, styles.empty, { width: Math.max(width, 1), height: Math.max(height, 1) }]}>
        <Ionicons name="person-outline" size={48} color={colors.textMuted} />
      </View>
    );
  }

  if (previewOnly) {
    const first = items[0];
    return (
      <View style={[styles.shell, { width, height }]}>
        {first.kind === 'photo' ? (
          <HostMediaPhotoSlide uri={first.url} />
        ) : (
          <HostMediaVideoSlide uri={first.url} active={false} />
        )}
      </View>
    );
  }

  const canBrowse = interactive && items.length > 1;

  return (
    <View style={[styles.shell, { width, height }]}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, i) => `${item.kind}-${item.url}-${i}`}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        scrollEnabled={canBrowse}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={onScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        bounces={canBrowse}
        decelerationRate="fast"
        removeClippedSubviews={false}
        windowSize={3}
      />

      {items.length > 1 ? (
        <View style={styles.progressRow} pointerEvents="none">
          {items.map((item, i) => (
            <View
              key={`seg-${i}`}
              style={[
                styles.progressSeg,
                i === index && styles.progressSegActive,
                item.kind === 'video' && styles.progressSegVideo,
              ]}
            />
          ))}
        </View>
      ) : null}

      {showCounter && items.length > 1 ? (
        <Text style={styles.counter} pointerEvents="none">
          {index + 1} / {items.length}
          {items[index]?.kind === 'video' ? ' · Intro' : ''}
        </Text>
      ) : null}

      {canBrowse ? (
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

      {interactive && onCenterPress ? (
        items.length > 1 ? (
          <Pressable
            style={styles.tapCenter}
            onPress={onCenterPress}
            accessibilityRole="button"
            accessibilityLabel="View plan details"
          />
        ) : (
          <Pressable
            style={styles.tapFull}
            onPress={onCenterPress}
            accessibilityRole="button"
            accessibilityLabel="View plan details"
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d3a',
  },
  slide: { flex: 1, backgroundColor: '#0F172A' },
  media: { width: '100%', height: '100%' },
  inactiveVideoPoster: { backgroundColor: '#0F172A' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(237,232,255,0.5)',
    gap: 8,
  },
  loadingTxt: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
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
    backgroundColor: 'rgba(255, 74, 114,0.55)',
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
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
  tapCenter: {
    position: 'absolute',
    left: '32%',
    right: '32%',
    top: 0,
    bottom: 0,
    zIndex: 2,
  },
  tapFull: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
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
    backgroundColor: 'rgba(94, 82, 255,0.88)',
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
    fontFamily: fonts.bold,
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
});
