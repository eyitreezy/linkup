/**
 * Subtle creator spotlight indicator — host row, not boost corner badge.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  variant?: 'light' | 'onDark';
  style?: StyleProp<ViewStyle>;
};

export function CreatorSpotlightChip({ variant = 'light', style }: Props) {
  const onDark = variant === 'onDark';
  return (
    <View style={[styles.chip, onDark && styles.chipOnDark, style]}>
      <Ionicons name="star" size={10} color={onDark ? '#FDE68A' : '#D97706'} />
      <Text style={[styles.label, onDark && styles.labelOnDark]}>Featured</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    alignSelf: 'flex-start',
  },
  chipOnDark: {
    backgroundColor: 'rgba(251, 191, 36, 0.22)',
    borderColor: 'rgba(253, 224, 71, 0.35)',
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  labelOnDark: {
    color: '#FDE68A',
  },
});
