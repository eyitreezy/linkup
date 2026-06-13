import { Input } from '@/components/Input';
import { DiscoverMoodStrip } from '@/components/discovery/DiscoverMoodStrip';
import type { FeedViewMode } from '@/components/plans/NearbyPlansHeader';
import { colors, radius, spacing } from '@/constants/theme';
import type { DiscoveryMood } from '@/lib/discovery/moodFilter';
import type { HostPresenceFilter } from '@/lib/presence/derivePresenceUi';
import { AppFeedbackModal } from '@/components/ui/AppFeedbackModal';
import { formatFilterPriceMajor, parseFilterPriceMajor } from '@/lib/discovery/feedPriceFilter';
import { TierBadge } from '@/components/TierBadge';
import { isDiscoverFilterConstraintActive } from '@/lib/discovery/parseStoredFeedFilters';
import { effectiveDiscoveryRadiusKm } from '@/lib/plans/discoveryRadius';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FeedFilterState = {
  maxDistanceKm: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  verifiedHostsOnly: boolean;
  hostPresence: HostPresenceFilter;
  /** When false, discover shows all non-expired plans (distance is sort-only). */
  clientFiltersActive: boolean;
};

const HOST_PRESENCE_OPTIONS: { id: HostPresenceFilter; label: string }[] = [
  { id: 'all', label: 'All hosts' },
  { id: 'online', label: 'Online now' },
  { id: 'offline', label: 'Offline' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  isPremium: boolean;
  initial: FeedFilterState;
  discoveryMood: DiscoveryMood;
  feedMode: FeedViewMode;
  onApply: (next: FeedFilterState, nextMood: DiscoveryMood, nextFeedMode: FeedViewMode) => void;
  onUpgrade: () => void;
  baseRadiusKm: number;
  browseRadiusKm: number;
  hasWiderRadius: boolean;
  effectiveTier: SubscriptionTier;
};

export function PlansFilterSheet({
  visible,
  onClose,
  isPremium,
  initial,
  discoveryMood,
  feedMode,
  onApply,
  onUpgrade,
  baseRadiusKm,
  browseRadiusKm,
  hasWiderRadius,
  effectiveTier,
}: Props) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = winH * 0.92;
  const [maxKm, setMaxKm] = useState(initial.maxDistanceKm);
  const [minPriceText, setMinPriceText] = useState(() => formatFilterPriceMajor(initial.minPriceCents));
  const [maxPriceText, setMaxPriceText] = useState(() => formatFilterPriceMajor(initial.maxPriceCents));
  const [verifiedOnly, setVerifiedOnly] = useState(initial.verifiedHostsOnly);
  const [hostPresence, setHostPresence] = useState<HostPresenceFilter>(initial.hostPresence);
  const [mood, setMood] = useState<DiscoveryMood>(discoveryMood);
  const [displayMode, setDisplayMode] = useState<FeedViewMode>(feedMode);
  const [priceRangeErrorOpen, setPriceRangeErrorOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setMaxKm(initial.maxDistanceKm);
      setMinPriceText(formatFilterPriceMajor(initial.minPriceCents));
      setMaxPriceText(formatFilterPriceMajor(initial.maxPriceCents));
      setVerifiedOnly(initial.verifiedHostsOnly);
      setHostPresence(initial.hostPresence);
      setMood(discoveryMood);
      setDisplayMode(feedMode);
    }
  }, [visible, initial, discoveryMood, feedMode]);

  function apply() {
    const minPriceCents = parseFilterPriceMajor(minPriceText);
    const maxPriceCents = parseFilterPriceMajor(maxPriceText);
    if (minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents) {
      setPriceRangeErrorOpen(true);
      return;
    }
    const verifiedHostsOnly = isPremium ? verifiedOnly : false;
    onApply(
      {
        maxDistanceKm: maxKm,
        minPriceCents,
        maxPriceCents,
        verifiedHostsOnly,
        hostPresence,
        clientFiltersActive: isDiscoverFilterConstraintActive(
          { maxDistanceKm: maxKm, minPriceCents, maxPriceCents, verifiedHostsOnly, hostPresence },
          baseRadiusKm
        ),
      },
      mood,
      displayMode
    );
    onClose();
  }

  return (
    <>
      <AppFeedbackModal
        visible={priceRangeErrorOpen}
        onClose={() => setPriceRangeErrorOpen(false)}
        variant="warning"
        kicker="Filters"
        title="Price range"
        message="Minimum price cannot be higher than maximum price."
        primaryLabel="Got it"
      />
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheetOuter, { height: sheetHeight, maxHeight: sheetHeight }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FAF7FF', '#FFFAFC', '#F4FFFB']}
            locations={[0, 0.35, 0.72, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGradient}
          >
            <View style={styles.sheetBody}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandleWrap} pointerEvents="none">
                  <View style={styles.sheetHandle} />
                </View>

                <View style={styles.titleRow}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.titleIcon}
                  >
                    <Ionicons name="options-outline" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.titleTextCol}>
                    <Text style={styles.title}>Discover filters</Text>
                    <Text style={styles.sectionLead}>
                      Tune your feed — vibe first, then distance{isPremium ? ', price, and host signals' : ''}.
                    </Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces
              >
              <Text style={styles.sectionEyebrow}>Display</Text>
              <View style={styles.sectionCard}>
                <Text style={styles.label}>Feed layout</Text>
                <View style={styles.displayPillRow}>
                  {(
                    [
                      { id: 'swipe' as const, label: 'Swipe', icon: 'albums-outline' as const },
                      { id: 'list' as const, label: 'List', icon: 'list-outline' as const },
                    ] as const
                  ).map((opt) => {
                    const active = displayMode === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setDisplayMode(opt.id)}
                        style={({ pressed }) => [
                          styles.displayPillOuter,
                          active && styles.displayPillOuterOn,
                          pressed && styles.displayPillPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${opt.label} view`}
                      >
                        {active ? (
                          <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.displayPillGradient}
                          >
                            <Ionicons name={opt.icon} size={17} color="#fff" />
                            <Text style={styles.displayPillTxtOn}>{opt.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.displayPillInner}>
                            <Ionicons name={opt.icon} size={17} color={colors.textMuted} />
                            <Text style={styles.displayPillTxt}>{opt.label}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.sectionEyebrow}>Vibe</Text>
              <LinearGradient
                colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.35)', 'rgba(16,185,129,0.25)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.vibeBlockRing}
              >
                <View style={styles.vibeBlockInner}>
                  <DiscoverMoodStrip variant="embedded" value={mood} onChange={setMood} />
                </View>
              </LinearGradient>

              <Text style={styles.sectionEyebrow}>Host status</Text>
              <View style={styles.sectionCard}>
                <Text style={styles.label}>Show hosts who are</Text>
                <View style={styles.presenceChipRow}>
                  {HOST_PRESENCE_OPTIONS.map((opt) => {
                    const active = hostPresence === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setHostPresence(opt.id)}
                        style={({ pressed }) => [
                          styles.presenceChipOuter,
                          active && styles.presenceChipOuterOn,
                          pressed && styles.presenceChipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={opt.label}
                      >
                        {active ? (
                          <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.presenceChipGradient}
                          >
                            <Text style={styles.presenceChipTxtOn}>{opt.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.presenceChipInner}>
                            <Text style={styles.presenceChipTxt}>{opt.label}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.presenceHint}>
                  Respects each host&apos;s privacy settings. Hosts who hide activity won&apos;t appear in Online or
                  Offline filters.
                </Text>
              </View>

              <Text style={styles.sectionEyebrow}>Location</Text>
              <View style={styles.sectionCard}>
                <Text style={styles.label}>Max distance · {Math.round(maxKm)} km</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={5}
                  maximumValue={Math.max(100, browseRadiusKm, baseRadiusKm, maxKm)}
                  step={1}
                  value={maxKm}
                  onValueChange={setMaxKm}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
                {hasWiderRadius && effectiveTier !== 'FREE' ? (
                  <Text style={styles.filterHintText}>
                    Your {effectiveTier.charAt(0) + effectiveTier.slice(1).toLowerCase()} subscription
                    extends your reach to{' '}
                    <Text style={styles.filterHintBold}>
                      {effectiveDiscoveryRadiusKm(baseRadiusKm, effectiveTier, true)} km
                    </Text>
                  </Text>
                ) : (
                  <Pressable style={styles.widerRadiusUpsell} onPress={onUpgrade}>
                    <View style={styles.widerRadiusUpsellRow}>
                      <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                      <Text style={styles.widerRadiusUpsellTxt}>
                        Wider reach available on Silver and above
                      </Text>
                      <TierBadge tier="SILVER" compact />
                    </View>
                  </Pressable>
                )}
              </View>

              {!isPremium ? (
                <Pressable style={styles.upsellOuter} onPress={onUpgrade}>
                  <LinearGradient
                    colors={['rgba(232,226,255,0.95)', 'rgba(255,240,248,0.95)', 'rgba(224,252,241,0.65)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.upsell}
                  >
                    <View style={styles.upsellIconRow}>
                      <Ionicons name="diamond-outline" size={22} color={colors.primary} />
                      <Text style={styles.upsellTitle}>Unlock refined filters</Text>
                    </View>
                    <Text style={styles.upsellBody}>
                      Premium members set a budget ceiling and can require verified hosts — clearer matches with less noise.
                    </Text>
                    <Text style={styles.upsellCta}>Explore Premium →</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionEyebrowInCard}>Budget & trust</Text>
                  <View style={styles.priceRow}>
                    <View style={styles.priceCol}>
                      <Input
                        label="Min price (approx.)"
                        variant="onboardingFlat"
                        containerStyle={styles.priceInputWrap}
                        value={minPriceText}
                        onChangeText={setMinPriceText}
                        placeholder="e.g. 2000"
                        keyboardType="number-pad"
                        accessibilityLabel="Minimum plan price filter"
                      />
                    </View>
                    <View style={styles.priceCol}>
                      <Input
                        label="Max price (approx.)"
                        variant="onboardingFlat"
                        containerStyle={styles.priceInputWrap}
                        value={maxPriceText}
                        onChangeText={setMaxPriceText}
                        placeholder="e.g. 15000"
                        keyboardType="number-pad"
                        accessibilityLabel="Maximum plan price filter"
                      />
                    </View>
                  </View>
                  <Text style={styles.priceHint}>Leave blank for no limit. Amounts are approximate (₦).</Text>
                  <View style={styles.row}>
                    <Text style={styles.switchLabel}>Verified hosts only</Text>
                    <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{ true: colors.primary }} />
                  </View>
                </View>
              )}
              </ScrollView>

              <View style={[styles.footerActions, { paddingBottom: spacing.sm + insets.bottom }]}>
                <View style={styles.footerRow}>
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [styles.footerCancel, pressed && styles.footerPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel filters"
                    hitSlop={8}
                  >
                    <Text style={styles.footerCancelTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={apply}
                    style={({ pressed }) => [styles.footerApplyOuter, pressed && styles.footerPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Apply discover filters"
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.footerApplyGrad}
                    >
                      <Text style={styles.footerApplyTxt}>Apply filters</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 29, 38, 0.52)',
    justifyContent: 'flex-end',
  },
  sheetOuter: {
    width: '100%',
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    overflow: 'hidden',
  },
  sheetGradient: {
    flex: 1,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  sheetHeader: {
    flexShrink: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetScroll: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.lg,
  },
  sheetHandleWrap: { alignItems: 'center', paddingBottom: spacing.sm },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(108,99,255,0.25)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sectionLead: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionEyebrowInCard: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: 0,
  },
  vibeBlockRing: {
    borderRadius: radius.lg + 2,
    padding: 2,
    marginBottom: spacing.lg,
  },
  vibeBlockInner: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.94)',
    overflow: 'hidden',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(108,99,255,0.08)',
  },
  sectionCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
  },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  priceCol: {
    flex: 1,
    minWidth: 0,
  },
  priceInputWrap: {
    marginBottom: 0,
  },
  priceHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 17,
  },
  slider: { width: '100%', height: 40, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, paddingRight: spacing.md },
  upsellOuter: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  upsell: {
    padding: spacing.md,
  },
  upsellIconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upsellTitle: { fontSize: 17, fontWeight: '800', color: colors.text, flex: 1 },
  upsellBody: { fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 21, fontWeight: '500' },
  upsellCta: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: spacing.md },
  footerActions: {
    flexShrink: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108,99,255,0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  footerCancel: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(26, 29, 38, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  footerCancelTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
  footerApplyOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  footerApplyGrad: {
    minHeight: 52,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: radius.button,
  },
  footerApplyTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  footerPressed: { opacity: 0.9 },
  presenceChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  presenceChipOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  presenceChipOuterOn: {
    borderColor: 'transparent',
  },
  presenceChipPressed: { opacity: 0.92 },
  presenceChipInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presenceChipGradient: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  presenceChipTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  presenceChipTxtOn: { fontSize: 14, fontWeight: '800', color: '#fff' },
  presenceHint: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  filterHintText: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  filterHintBold: {
    fontWeight: '800',
    color: colors.primary,
  },
  widerRadiusUpsell: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
    backgroundColor: 'rgba(237,232,255,0.45)',
  },
  widerRadiusUpsellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  widerRadiusUpsellTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  displayPillRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  displayPillOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  displayPillOuterOn: {
    borderColor: 'transparent',
  },
  displayPillPressed: { opacity: 0.92 },
  displayPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  displayPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.button,
  },
  displayPillTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  displayPillTxtOn: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
