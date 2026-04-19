/**
 * Nearby Plans — title row with filter and location hint.
 */
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  locationLabel: string;
  onPressFilter: () => void;
  showUndo?: boolean;
  onUndoLastHide?: () => void;
};

export function NearbyPlansHeader({ locationLabel, onPressFilter, showUndo, onUndoLastHide }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        <Text style={styles.title}>Nearby Plans</Text>
        <Text style={styles.sub}>Find things happening around you</Text>
        {showUndo && onUndoLastHide ? (
          <Pressable onPress={onUndoLastHide} style={styles.undoChip} accessibilityRole="button" accessibilityLabel="Undo last hidden plan">
            <Text style={styles.undoTxt}>Undo last hide</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onPressFilter} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Filter plans">
          <Ionicons name="options-outline" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.locPill}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={styles.locTxt} numberOfLines={1}>
            {locationLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 2 },
  iconBtn: { padding: spacing.xs },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  locTxt: { fontSize: 12, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  undoChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  undoTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
});
