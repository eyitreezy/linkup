import { colors, fonts, radius, spacing } from '@/constants/theme';
import {
  CONVERSATION_STARTER_CATEGORIES,
  type ConversationStarterCategoryId,
  pickQuickPickBatch,
  sharedPublicInterests,
} from '@/lib/matchmaker/conversationStarters';
import type { ProfilePreferences } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
  viewerPreferences?: ProfilePreferences | null;
  peerPreferences?: ProfilePreferences | null;
};

export function MatchMakerQuickPickSheet({
  visible,
  onClose,
  onSelect,
  viewerPreferences,
  peerPreferences,
}: Props) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.min(winH * 0.88, 640);

  const [categoryId, setCategoryId] = useState<ConversationStarterCategoryId>('easy_icebreakers');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [interestIndex, setInterestIndex] = useState(0);
  const shownInSessionRef = useRef<Set<string>>(new Set());

  const sharedInterests = useMemo(
    () => sharedPublicInterests(viewerPreferences, peerPreferences),
    [viewerPreferences, peerPreferences]
  );

  const activeSharedInterest = useMemo(() => {
    if (sharedInterests.length === 0) return null;
    const idx = interestIndex % sharedInterests.length;
    return sharedInterests[idx] ?? null;
  }, [sharedInterests, interestIndex]);

  const suggestions = useMemo(() => {
    if (!visible) return [];
    return pickQuickPickBatch({
      categoryId,
      sharedInterest: categoryId === 'shared_interests' ? activeSharedInterest : null,
      refreshIndex,
      excludeTexts: shownInSessionRef.current,
    });
  }, [visible, categoryId, activeSharedInterest, refreshIndex]);

  useEffect(() => {
    if (!visible) {
      shownInSessionRef.current = new Set();
      setRefreshIndex(0);
      setInterestIndex(0);
      setCategoryId('easy_icebreakers');
    }
  }, [visible]);

  const handleShowMore = useCallback(() => {
    suggestions.forEach((s) => shownInSessionRef.current.add(s));
    setRefreshIndex((n) => n + 1);
    if (categoryId === 'shared_interests' && sharedInterests.length > 1) {
      setInterestIndex((n) => n + 1);
    }
  }, [suggestions, categoryId, sharedInterests.length]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close conversation starters" />
      <View style={[s.sheet, { height: sheetHeight, paddingBottom: insets.bottom }]}>
        <View style={s.handle} />
        <View style={s.headerRow}>
          <View style={s.headerTextCol}>
            <Text style={s.title}>Start a conversation</Text>
            <Text style={s.subtitle}>
              Pick a starter to add to your message. You can edit it before you send.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={s.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
          style={s.chipScroll}
        >
          {CONVERSATION_STARTER_CATEGORIES.map((cat) => {
            const selected = cat.id === categoryId;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(cat.id)}
                style={[s.chip, selected && s.chipSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[s.chipText, selected && s.chipTextSelected]} numberOfLines={2}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          style={s.listScroll}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {categoryId === 'shared_interests' && sharedInterests.length === 0 ? (
            <View style={s.emptyShared}>
              <Text style={s.emptySharedText}>
                We could not find shared interests on your public profiles yet. These openers work
                without naming a specific hobby.
              </Text>
            </View>
          ) : null}
          {suggestions.map((line) => (
            <Pressable
              key={`${categoryId}-${refreshIndex}-${line}`}
              onPress={() => {
                shownInSessionRef.current.add(line);
                onSelect(line);
              }}
              style={({ pressed }) => [s.starterRow, pressed && s.starterRowPressed]}
              accessibilityRole="button"
            >
              <Text style={s.starterText}>{line}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={handleShowMore}
            style={({ pressed }) => [s.showMoreBtn, pressed && s.showMorePressed]}
            accessibilityRole="button"
            accessibilityLabel="Show more conversation starters"
          >
            <Ionicons name="refresh" size={16} color={colors.textMuted} />
            <Text style={s.showMoreText}>Show more</Text>
          </Pressable>
          <Pressable onPress={onClose} style={s.cancelBtn} accessibilityRole="button">
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.medium,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    borderRadius: radius.full,
  },
  chipScroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EDE8FF',
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  listScroll: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyShared: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  emptySharedText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  starterRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  starterRowPressed: {
    borderColor: 'rgba(94, 82, 255, 0.4)',
    backgroundColor: 'rgba(237, 232, 255, 0.35)',
  },
  starterText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  showMorePressed: { opacity: 0.85 },
  showMoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  cancelText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
});
