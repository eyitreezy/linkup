/**
 * Discovery toolbar — location, filter, optional undo (display mode lives in filter sheet).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type FeedViewMode = 'swipe' | 'list';

type Props = {
  locationLabel: string;
  onPressLocation?: () => void;
  onPressFilter: () => void;
  showUndo?: boolean;
  onUndoLastHide?: () => void;
  isIncognitoActive?: boolean;
};

export function NearbyPlansHeader({
  locationLabel,
  onPressLocation,
  onPressFilter,
  showUndo,
  onUndoLastHide,
  isIncognitoActive,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.leadCol}>
        <View style={styles.locRow}>
          <Pressable
            onPress={onPressLocation}
            disabled={!onPressLocation}
            style={({ pressed }) => [
              styles.locPillOuter,
              onPressLocation && pressed && styles.locPillPressed,
            ]}
            hitSlop={6}
            accessibilityRole={onPressLocation ? 'button' : undefined}
            accessibilityLabel={onPressLocation ? `Location: ${locationLabel}. Open travel mode` : undefined}
          >
            <LinearGradient
              colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.locPill}
            >
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.locTxt} numberOfLines={1}>
                {locationLabel}
              </Text>
            </LinearGradient>
          </Pressable>
          {isIncognitoActive ? (
            <View style={styles.incognitoChip}>
              <Ionicons name="eye-off-outline" size={12} color={colors.textMuted} />
              <Text style={styles.incognitoLabel}>Incognito</Text>
            </View>
          ) : null}
        </View>
        {showUndo && onUndoLastHide ? (
          <Pressable
            onPress={onUndoLastHide}
            style={styles.undoChip}
            accessibilityRole="button"
            accessibilityLabel="Undo last hidden plan"
          >
            <Text style={styles.undoTxt}>Undo last hide</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onPressFilter}
        style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Filter discover"
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.98)', 'rgba(232,226,255,0.9)', 'rgba(255,240,248,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.filterBtnGrad}
        >
          <Ionicons name="options-outline" size={21} color={colors.primary} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  leadCol: { flex: 1, minWidth: 0, gap: spacing.xs },
  locRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  locPillOuter: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  locPillPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.18)',
  },
  locTxt: { fontSize: 13, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  incognitoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.18)',
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  incognitoLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  undoChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  undoTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  filterBtn: {
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.22)',
  },
  filterBtnPressed: { opacity: 0.9 },
  filterBtnGrad: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
