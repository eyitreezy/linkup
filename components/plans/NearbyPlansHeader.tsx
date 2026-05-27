/**
 * Discovery header — warm copy + feed mode toggle (swipe vs list).
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
  feedMode?: FeedViewMode;
  onFeedModeChange?: (mode: FeedViewMode) => void;
};

export function NearbyPlansHeader({
  locationLabel,
  onPressLocation,
  onPressFilter,
  showUndo,
  onUndoLastHide,
  feedMode,
  onFeedModeChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.sub}>People nearby suggesting real-life hangouts</Text>
        {feedMode && onFeedModeChange ? (
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => onFeedModeChange('swipe')}
              style={[styles.modeChip, feedMode === 'swipe' && styles.modeChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: feedMode === 'swipe' }}
            >
              <Ionicons
                name="albums-outline"
                size={16}
                color={feedMode === 'swipe' ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.modeTxt, feedMode === 'swipe' && styles.modeTxtOn]}>Swipe</Text>
            </Pressable>
            <Pressable
              onPress={() => onFeedModeChange('list')}
              style={[styles.modeChip, feedMode === 'list' && styles.modeChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: feedMode === 'list' }}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={feedMode === 'list' ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.modeTxt, feedMode === 'list' && styles.modeTxtOn]}>List</Text>
            </Pressable>
          </View>
        ) : null}
        {showUndo && onUndoLastHide ? (
          <Pressable onPress={onUndoLastHide} style={styles.undoChip} accessibilityRole="button" accessibilityLabel="Undo last hidden plan">
            <Text style={styles.undoTxt}>Undo last hide</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.actions}>
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
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipOn: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  modeTxt: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  modeTxtOn: { color: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 2 },
  filterBtn: {
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.22)',
  },
  filterBtnPressed: { opacity: 0.9 },
  filterBtnGrad: {
    paddingHorizontal: 11,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locPillOuter: {
    maxWidth: 130,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  locPillPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.18)',
  },
  locTxt: { fontSize: 12, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  undoChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  undoTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
});
