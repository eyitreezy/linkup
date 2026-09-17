import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  signals: string[];
};

export function CompatibilitySignalChips({ signals }: Props) {
  if (signals.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {signals.map((signal) => (
        <View key={signal} style={styles.chip}>
          <Text style={styles.chipText}>{signal}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: spacing.xs },
  chip: {
    backgroundColor: MM.surfaceWarm,
    borderWidth: 1,
    borderColor: MM.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontWeight: '700',
    color: MM.accent,
  },
});
