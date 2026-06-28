import { colors, fonts, radius } from '@/constants/theme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface SmartSuggestionsBarProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  /** Match composer sheet surface when provided. */
  backgroundColor?: string;
  borderColor?: string;
}

export function SmartSuggestionsBar({
  suggestions,
  onSelect,
  backgroundColor = colors.surface,
  borderColor = colors.border,
}: SmartSuggestionsBarProps) {
  if (suggestions.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor, borderBottomColor: borderColor }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            style={[styles.chip, { borderColor }]}
            onPress={() => onSelect(suggestion)}
            accessibilityRole="button"
            accessibilityLabel={`Insert suggestion: ${suggestion}`}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: radius.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    maxWidth: 280,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
