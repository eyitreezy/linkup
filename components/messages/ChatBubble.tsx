/**
 * WhatsApp-style bubble with Bumble-ish padding; supports text + image + short video.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ChatBubbleMedia = {
  kind: 'image' | 'video';
  displayUrl: string;
};

export type ChatBubbleProps = {
  body: string | null;
  media: ChatBubbleMedia | null;
  isMine: boolean;
  /** Legacy rows stored as `[image] url` in body */
  legacyImageUrl?: string | null;
  /** Soft-deleted for everyone */
  isDeleted?: boolean;
  /** Shown when message was edited */
  showEdited?: boolean;
  onLongPress?: () => void;
};

export function ChatBubble({
  body,
  media,
  isMine,
  legacyImageUrl,
  isDeleted,
  showEdited,
  onLongPress,
}: ChatBubbleProps) {
  const [videoErr, setVideoErr] = useState(false);
  const text = (body ?? '').trim();
  const showText = text.length > 0;
  const showLegacy = !!legacyImageUrl && !media;
  const showMedia = !!media || showLegacy;

  if (isDeleted) {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapThem]}
      >
        <View style={[styles.bubble, styles.bubbleDeleted, isMine ? styles.bubbleDeletedMine : styles.bubbleDeletedThem]}>
          <Text style={[styles.deletedText, isMine ? styles.deletedTextMine : styles.deletedTextThem]}>
            {isMine ? 'You deleted this message' : 'This message was deleted'}
          </Text>
        </View>
      </Pressable>
    );
  }

  if (!showText && !showMedia) return null;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapThem]}
    >
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleThem]}>
        {showMedia ? (
          <View style={styles.mediaBlock}>
            {media?.kind === 'video' && !videoErr ? (
              <Video
                source={{ uri: media.displayUrl }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onError={() => setVideoErr(true)}
              />
            ) : (
              <Image
                source={{ uri: media?.kind === 'image' ? media.displayUrl : legacyImageUrl! }}
                style={styles.image}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
            )}
            {videoErr ? (
              <Text style={styles.videoFallback}>Could not play video. Check your connection.</Text>
            ) : null}
          </View>
        ) : null}
        {showText ? (
          <Text style={[styles.text, isMine ? styles.textMine : styles.textThem]}>{body}</Text>
        ) : null}
        {showEdited && showText ? (
          <Text style={[styles.editedHint, isMine ? styles.editedHintMine : styles.editedHintThem]}>Edited</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ChatBubbleStatus({ failed, onRetry }: { failed: boolean; onRetry?: () => void }) {
  if (!failed) return null;
  return (
    <Pressable onPress={onRetry} style={styles.failBanner}>
      <Text style={styles.failText}>Not sent · Tap to retry</Text>
    </Pressable>
  );
}

const BUBBLE_MAX = '82%' as const;

const styles = StyleSheet.create({
  wrap: { maxWidth: BUBBLE_MAX, marginBottom: spacing.sm },
  wrapMine: { alignSelf: 'flex-end' },
  wrapThem: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleThem: { backgroundColor: colors.surface },
  bubbleDeleted: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  bubbleDeletedMine: { backgroundColor: 'rgba(0,0,0,0.08)' },
  bubbleDeletedThem: { backgroundColor: colors.surface },
  deletedText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  deletedTextMine: { color: colors.textMuted },
  deletedTextThem: { color: colors.textMuted },
  editedHint: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  editedHintMine: { color: 'rgba(255,255,255,0.75)' },
  editedHintThem: { color: colors.textMuted },
  text: { fontSize: 16, lineHeight: 22 },
  textMine: { color: '#fff' },
  textThem: { color: colors.text },
  mediaBlock: { marginBottom: 6, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.border },
  video: { width: 240, height: 180, backgroundColor: '#000' },
  videoFallback: { color: colors.textMuted, fontSize: 13, padding: 8 },
  failBanner: { alignSelf: 'flex-end', marginBottom: 4, marginRight: 4 },
  failText: { fontSize: 12, color: '#c62828', fontWeight: '600' },
});
