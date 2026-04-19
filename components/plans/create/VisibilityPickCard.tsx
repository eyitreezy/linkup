/**
 * Bumble-style selectable card for plan visibility (PL2).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
};

export function VisibilityPickCard({ title, description, icon, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, selected && styles.iconCircleOn]}>
          <Ionicons name={icon} size={26} color={selected ? colors.primary : colors.textMuted} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, selected && styles.titleOn]}>{title}</Text>
          <Text style={styles.body}>{description}</Text>
        </View>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? colors.primary : colors.border}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOn: { backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  titleOn: { color: colors.primary },
  body: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
});
