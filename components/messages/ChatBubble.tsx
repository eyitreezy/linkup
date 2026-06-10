/**
 * Rounded bubbles — sent: purple→pink gradient; received: soft surface.
 */
import { colors, radius, spacing } from '@/constants/theme';
import type { ResolvedChatBubbleTheme } from '@/lib/messaging/chatAppearance';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

function ChatBubbleVideo({
  uri,
  style,
  onError,
}: {
  uri: string;
  style: ViewStyle;
  onError: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onError();
  });

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

export type ChatBubbleMedia = {
  kind: 'image' | 'video';
  displayUrl: string;
};

export type ChatBubbleMeta = {
  timeLabel: string;
  /** Single tick — message reached the thread. */
  showSent?: boolean;
  /** Double tick — peer read cursor passed this message. */
  showRead?: boolean;
};

export type ChatBubbleQuote = {
  senderLabel: string;
  preview: string;
  isDeleted?: boolean;
  onPress?: () => void;
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
  /** Quoted message when replying */
  quote?: ChatBubbleQuote | null;
  /** Brief highlight when jumping to a quoted message */
  highlighted?: boolean;
  onLongPress?: () => void;
  meta?: ChatBubbleMeta | null;
  /** Chat look (optional — defaults to app lavender theme). */
  theme?: ResolvedChatBubbleTheme | null;
};

export function ChatBubble({
  body,
  media,
  isMine,
  legacyImageUrl,
  isDeleted,
  showEdited,
  quote,
  highlighted,
  onLongPress,
  meta,
  theme,
}: ChatBubbleProps) {
  const [videoErr, setVideoErr] = useState(false);
  const text = (body ?? '').trim();
  const showText = text.length > 0;
  const showLegacy = !!legacyImageUrl && !media;
  const showMedia = !!media || showLegacy;

  const th = theme;

  if (isDeleted) {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapThem]}
      >
        <View
          style={[
            styles.bubble,
            styles.bubbleDeleted,
            isMine ? styles.bubbleDeletedMine : styles.bubbleDeletedThem,
          ]}
        >
          <Text style={[styles.deletedText, isMine ? styles.deletedTextMine : styles.deletedTextThem]}>
            {isMine ? 'You deleted this message' : 'This message was deleted'}
          </Text>
        </View>
      </Pressable>
    );
  }

  if (!showText && !showMedia) return null;

  const quoteBlock = quote ? (
    <Pressable
      onPress={quote.onPress}
      disabled={!quote.onPress}
      style={({ pressed }) => [
        styles.quoteWrap,
        isMine ? styles.quoteWrapMine : styles.quoteWrapThem,
        quote.onPress && pressed && styles.quotePressed,
      ]}
    >
      <View style={[styles.quoteBar, isMine ? styles.quoteBarMine : styles.quoteBarThem]} />
      <View style={styles.quoteTextCol}>
        <Text style={[styles.quoteSender, isMine ? styles.quoteSenderMine : styles.quoteSenderThem]}>
          {quote.senderLabel}
        </Text>
        <Text
          style={[styles.quotePreview, isMine ? styles.quotePreviewMine : styles.quotePreviewThem]}
          numberOfLines={2}
        >
          {quote.isDeleted ? 'Message deleted' : quote.preview}
        </Text>
      </View>
    </Pressable>
  ) : null;

  const inner = (
    <>
      {quoteBlock}
      {showMedia ? (
        <View style={styles.mediaBlock}>
          {media?.kind === 'video' && !videoErr ? (
            <ChatBubbleVideo
              uri={media.displayUrl}
              style={styles.video}
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
        <Text
          style={[
            styles.text,
            { fontSize: th?.fontSize ?? 16, fontWeight: th?.fontWeight ?? '400' },
            isMine ? (th ? { color: th.textMine } : styles.textMine) : th ? { color: th.textThem } : styles.textThem,
          ]}
        >
          {body}
        </Text>
      ) : null}
      {showEdited && showText ? (
        <Text
          style={[
            styles.editedHint,
            isMine
              ? th
                ? { color: th.editedMine, fontSize: (th.fontSize ?? 16) - 2 }
                : styles.editedHintMine
              : th
                ? { color: th.editedThem, fontSize: (th.fontSize ?? 16) - 2 }
                : styles.editedHintThem,
          ]}
        >
          Edited
        </Text>
      ) : null}
      {meta ? (
        <View style={[styles.metaRow, isMine ? styles.metaRowMine : styles.metaRowThem]}>
          <Text
            style={[
              styles.metaTime,
              isMine
                ? th
                  ? { color: th.metaTimeMine }
                  : styles.metaTimeMine
                : th
                  ? { color: th.metaTimeThem }
                  : styles.metaTimeThem,
            ]}
          >
            {meta.timeLabel}
          </Text>
          {isMine && meta.showRead ? (
            <Text style={[styles.metaRead, th ? { color: th.metaRead } : undefined]}>✓✓</Text>
          ) : null}
          {isMine && !meta.showRead && meta.showSent ? (
            <Text style={[styles.metaTick, th ? { color: th.metaTick } : undefined]}>✓</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[
        styles.wrap,
        isMine ? styles.wrapMine : styles.wrapThem,
        highlighted && styles.wrapHighlighted,
      ]}
    >
      {isMine ? (
        <LinearGradient
          colors={th?.mineBubble ?? [colors.primary, '#9D5CFF', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleMine]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={th?.themBubble ?? ['#FFFFFF', '#F4F0FF', '#FFF5F8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            styles.bubbleThem,
            styles.bubbleThemSurface,
            th ? { borderColor: th.themBubbleBorder } : null,
          ]}
        >
          {inner}
        </LinearGradient>
      )}
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
  wrapHighlighted: {
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
    borderRadius: radius.lg,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  quoteWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  quoteWrapMine: { backgroundColor: 'rgba(0,0,0,0.12)' },
  quoteWrapThem: { backgroundColor: 'rgba(108, 99, 255, 0.08)' },
  quotePressed: { opacity: 0.88 },
  quoteBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  quoteBarMine: { backgroundColor: 'rgba(255,255,255,0.85)' },
  quoteBarThem: { backgroundColor: colors.primary },
  quoteTextCol: { flex: 1, minWidth: 0 },
  quoteSender: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  quoteSenderMine: { color: 'rgba(255,255,255,0.92)' },
  quoteSenderThem: { color: colors.primary },
  quotePreview: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  quotePreviewMine: { color: 'rgba(255,255,255,0.82)' },
  quotePreviewThem: { color: colors.textMuted },
  bubble: {
    borderRadius: radius.xl,
    paddingVertical: 10,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  bubbleMine: {},
  bubbleThem: {},
  bubbleThemSurface: {
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  metaRowMine: { justifyContent: 'flex-end' },
  metaRowThem: { justifyContent: 'flex-start' },
  metaTime: { fontSize: 11, fontWeight: '600' },
  metaTimeMine: { color: 'rgba(255,255,255,0.72)' },
  metaTimeThem: { color: colors.textMuted },
  metaTick: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  metaRead: { fontSize: 12, color: 'rgba(200, 230, 255, 0.95)', fontWeight: '800', letterSpacing: -1 },
  mediaBlock: { marginBottom: 6, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.border },
  video: { width: 240, height: 180, backgroundColor: '#000' },
  videoFallback: { color: colors.textMuted, fontSize: 13, padding: 8 },
  failBanner: { alignSelf: 'flex-end', marginBottom: 4, marginRight: 4 },
  failText: { fontSize: 12, color: '#c62828', fontWeight: '600' },
});
