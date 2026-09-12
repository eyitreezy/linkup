import { colors, fonts, radius, spacing } from '@/constants/theme';
import { EMOJI_CATEGORIES, EMOJI_PICKER_HEIGHT, type EmojiCategory } from '@/lib/text/emojiCatalog';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onSelect: (emoji: string) => void;
  /** When true, omit bottom safe-area padding (parent already handles insets). */
  embedded?: boolean;
};

export function EmojiPickerPanel({ onSelect, embedded }: Props) {
  const insets = useSafeAreaInsets();
  const [activeCategoryId, setActiveCategoryId] = useState(EMOJI_CATEGORIES[0]?.id ?? 'smileys');

  const activeCategory = useMemo(
    () => EMOJI_CATEGORIES.find((c) => c.id === activeCategoryId) ?? EMOJI_CATEGORIES[0],
    [activeCategoryId]
  );

  const renderEmoji = ({ item }: ListRenderItemInfo<string>) => (
    <Pressable
      onPress={() => onSelect(item)}
      style={({ pressed }) => [styles.emojiCell, pressed && styles.emojiCellPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Insert ${item}`}
    >
      <Text style={styles.emoji}>{item}</Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.panel,
        {
          height: EMOJI_PICKER_HEIGHT + (embedded ? 0 : Math.max(insets.bottom, spacing.xs)),
          paddingBottom: embedded ? spacing.xs : Math.max(insets.bottom, spacing.xs),
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsScroll}
      >
        {EMOJI_CATEGORIES.map((category: EmojiCategory) => {
          const active = category.id === activeCategoryId;
          return (
            <Pressable
              key={category.id}
              onPress={() => setActiveCategoryId(category.id)}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={category.label}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{category.icon}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        key={activeCategory.id}
        data={activeCategory.emojis}
        keyExtractor={(item, index) => `${activeCategory.id}-${item}-${index}`}
        renderItem={renderEmoji}
        numColumns={8}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.gridContent}
        style={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.12)',
  },
  tabsScroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  tabsContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 4,
  },
  tab: {
    width: 40,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.72,
  },
  tabIconActive: {
    opacity: 1,
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  emojiCell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  emojiCellPressed: {
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
  },
  emoji: {
    fontSize: 26,
    fontFamily: fonts.regular,
  },
});
