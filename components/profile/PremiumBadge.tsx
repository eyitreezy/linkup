/**
 * Small premium pill — Badoo-style monetization cue without clutter.
 */
import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  /** When false, component renders null. */
  active: boolean;
  compact?: boolean;
};

export function PremiumBadge({ active, compact }: Props) {
  if (!active) return null;
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityRole="text">
      <Ionicons name="diamond" size={compact ? 11 : 13} color={colors.primary} />
      <Text style={[styles.txt, compact && styles.txtCompact]}>Premium</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.25)',
  },
  wrapCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  txt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  txtCompact: { fontSize: 10 },
});
