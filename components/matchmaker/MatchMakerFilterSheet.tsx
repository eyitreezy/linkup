import { MM_CTA_GRADIENT, MM_CTA_GRADIENT_LOCATIONS } from '@/constants/matchmakerTheme';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import {
  defaultMatchMakerFilter,
  isMatchMakerFilterActive,
  type MatchMakerFilterState,
  type MatchMakerSortBy,
} from '@/lib/matchmaker/filterState';
import { clampMaxDistanceKm, sliderMaxKmForTier } from '@/lib/plans/discoveryRadius';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  filter: MatchMakerFilterState;
  baseRadiusKm: number;
  effectiveTier: SubscriptionTier;
  onApply: (next: MatchMakerFilterState) => void;
};

const SORT_OPTIONS: { id: MatchMakerSortBy; label: string }[] = [
  { id: 'best_match', label: 'Best match' },
  { id: 'recently_joined', label: 'Recently joined' },
];

export function MatchMakerFilterSheet({
  visible,
  onClose,
  filter,
  effectiveTier,
  onApply,
}: Props) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = winH * 0.92;
  const sliderMax = sliderMaxKmForTier(effectiveTier);

  const [maxKm, setMaxKm] = useState<number | null>(filter.maxDistanceKm);
  const [sortBy, setSortBy] = useState<MatchMakerSortBy>(filter.sortBy);
  const [distanceTouched, setDistanceTouched] = useState(false);

  useEffect(() => {
    if (visible) {
      setMaxKm(filter.maxDistanceKm);
      setSortBy(filter.sortBy);
      setDistanceTouched(false);
    }
  }, [visible, filter]);

  function apply() {
    const distanceFilterActive = distanceTouched && maxKm != null;
    const appliedMaxKm =
      distanceFilterActive && maxKm != null ? clampMaxDistanceKm(maxKm, effectiveTier) : null;
    const next: MatchMakerFilterState = {
      maxDistanceKm: appliedMaxKm,
      sortBy,
      filterActive: isMatchMakerFilterActive({ maxDistanceKm: appliedMaxKm, sortBy }),
    };
    onApply(next);
    onClose();
  }

  function clearFilters() {
    onApply(defaultMatchMakerFilter());
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />

      <View style={[s.sheet, { height: sheetHeight }]}>
        <View style={s.handle} />

        <View style={s.header}>
          <Text style={s.headerTitle}>Filter MatchMaker</Text>
          <Pressable onPress={clearFilters} hitSlop={8}>
            <Text style={s.clearBtn}>Clear filters</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.sectionHeading}>Distance</Text>
          <View style={s.distanceRow}>
            <Text style={s.distanceLabel}>
              {maxKm == null ? 'No distance limit' : `Up to ${maxKm} km away`}
            </Text>
            {maxKm != null ? (
              <Pressable
                onPress={() => {
                  setMaxKm(null);
                  setDistanceTouched(false);
                }}
                hitSlop={8}
              >
                <Text style={s.removeCapBtn}>Remove cap</Text>
              </Pressable>
            ) : null}
          </View>
          <Slider
            style={s.slider}
            minimumValue={1}
            maximumValue={sliderMax}
            step={1}
            value={maxKm ?? sliderMax}
            onValueChange={(v) => {
              setMaxKm(Math.round(v));
              setDistanceTouched(true);
            }}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={Platform.OS === 'android' ? colors.primary : undefined}
          />
          <View style={s.sliderLabels}>
            <Text style={s.sliderEdge}>1 km</Text>
            <Text style={s.sliderEdge}>{sliderMax} km</Text>
          </View>
          <Text style={s.distanceNote}>Requires location to be set on your profile.</Text>

          <Text style={[s.sectionHeading, { marginTop: spacing.lg }]}>Sort by</Text>
          <View style={s.sortRow}>
            {SORT_OPTIONS.map((opt) => {
              const selected = sortBy === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSortBy(opt.id)}
                  style={{ borderRadius: radius.button, overflow: 'hidden' }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  {selected ? (
                    <LinearGradient
                      colors={[colors.primary, '#8B7CE8', colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.chipGrad}
                    >
                      <Text style={s.chipTxtOn}>{opt.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.chipIdle}>
                      <Text style={s.chipTxt}>{opt.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={s.footerNote}>
            These filters affect what you see in this session only. Your dealbreakers always apply.
          </Text>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <LinearGradient
            colors={[...MM_CTA_GRADIENT]}
            locations={[...MM_CTA_GRADIENT_LOCATIONS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.applyGradient}
          >
            <Pressable
              onPress={apply}
              style={({ pressed }) => [s.applyInner, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
            >
              <Text style={s.applyText}>Apply</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
  clearBtn: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distanceLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  removeCapBtn: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  slider: {
    width: '100%',
    height: 44,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderEdge: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  distanceNote: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipGrad: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipIdle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255, 0.22)',
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  chipTxtOn: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    fontFamily: fonts.bold,
  },
  footerNote: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyGradient: {
    borderRadius: 999,
  },
  applyInner: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
  },
});
