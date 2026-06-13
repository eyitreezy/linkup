/**
 * Inline search bar for chat thread header.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onCancel: () => void;
  resultCount?: number;
  currentIndex?: number;
  onPrevResult?: () => void;
  onNextResult?: () => void;
  searching?: boolean;
};

export function ChatSearchBar({
  query,
  onQueryChange,
  onCancel,
  resultCount = 0,
  currentIndex = 0,
  onPrevResult,
  onNextResult,
  searching,
}: Props) {
  const hasResults = resultCount > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <View style={styles.fieldOuter}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search messages"
            placeholderTextColor="rgba(15,23,42,0.38)"
            style={styles.input}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => onQueryChange('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn}>
          <Text style={styles.cancelTxt}>Cancel</Text>
        </Pressable>
      </View>
      {query.trim().length >= 3 ? (
        <View style={styles.navRow}>
          {searching ? (
            <Text style={styles.countLabel}>Searching…</Text>
          ) : hasResults ? (
            <>
              <Pressable
                onPress={onPrevResult}
                disabled={!onPrevResult}
                style={styles.navBtn}
                accessibilityLabel="Previous result"
              >
                <Ionicons name="chevron-up" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.countLabel}>
                {currentIndex + 1} of {resultCount}
              </Text>
              <Pressable
                onPress={onNextResult}
                disabled={!onNextResult}
                style={styles.navBtn}
                accessibilityLabel="Next result"
              >
                <Ionicons name="chevron-down" size={20} color={colors.primary} />
              </Pressable>
            </>
          ) : (
            <Text style={styles.countLabel}>No matches</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldOuter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  searchIcon: { marginRight: 6 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
    fontWeight: '500',
  },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelTxt: { fontSize: 16, fontWeight: '700', color: colors.primary },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: 2,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  countLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, minWidth: 72, textAlign: 'center' },
});
