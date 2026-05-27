/**
 * Hinge/Bumble-style horizontal mood categories for Discover.
 */
import { colors, radius, spacing } from '@/constants/theme';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const MOODS: { id: DiscoveryMood; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Everything near you' },
  { id: 'chill', label: 'Chill', hint: 'Low-key hangs' },
  { id: 'active', label: 'Active', hint: 'Move together' },
  { id: 'social', label: 'Social', hint: 'Go out' },
  { id: 'premium', label: 'Premium', hint: 'Paid & boosted' },
];

type Props = {
  value: DiscoveryMood;
  onChange: (m: DiscoveryMood) => void;
  /** Use inside modals/sheets: tighter horizontal alignment with parent padding */
  variant?: 'default' | 'embedded';
};

export function DiscoverMoodStrip({ value, onChange, variant = 'default' }: Props) {
  const embedded = variant === 'embedded';
  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <Text style={[styles.eyebrow, embedded && styles.eyebrowEmbedded]}>Pick a vibe</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, embedded && styles.rowEmbedded]}
      >
        {MOODS.map((m) => {
          const on = value === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => onChange(m.id)}
              style={({ pressed }) => [
                styles.chipOuter,
                on && styles.chipOuterOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityHint={m.hint}
            >
              {on ? (
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chipGradient}
                >
                  <Text style={styles.chipTxtOn}>{m.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.chipInner}>
                  <Text style={styles.chipTxt}>{m.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  wrapEmbedded: { marginBottom: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  eyebrowEmbedded: {
    marginHorizontal: 0,
    marginBottom: spacing.sm,
    color: colors.text,
    opacity: 0.72,
  },
  row: {
    paddingHorizontal: spacing.md,
    gap: 10,
    paddingBottom: 2,
  },
  rowEmbedded: {
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  chipOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  chipOuterOn: {
    borderColor: 'transparent',
  },
  pressed: { opacity: 0.92 },
  chipInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  chipTxtOn: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
