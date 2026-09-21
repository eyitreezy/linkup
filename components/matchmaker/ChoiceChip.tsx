import { colors, fonts, radius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function ChoiceChip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.chipOuter}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected ? (
        <LinearGradient
          colors={[colors.primary, '#8B7CE8', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chipGrad}
        >
          <Text style={styles.chipTxtOn}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.chipIdle}>
          <Text style={styles.chipTxt}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ChoiceChipRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.intentRow, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  intentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chipOuter: { borderRadius: radius.button, overflow: 'hidden' },
  chipGrad: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipIdle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255, 0.22)',
  },
  chipTxt: { fontSize: 13, fontWeight: '800', fontFamily: fonts.bold, color: colors.text },
  chipTxtOn: { fontSize: 13, fontWeight: '900', color: '#fff', fontFamily: fonts.bold },
});
