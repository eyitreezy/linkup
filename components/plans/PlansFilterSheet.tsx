import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

export type FeedFilterState = {
  maxDistanceKm: number;
  maxPriceCents: number | null;
  verifiedHostsOnly: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  isPremium: boolean;
  initial: FeedFilterState;
  onApply: (next: FeedFilterState) => void;
  onUpgrade: () => void;
  baseRadiusKm: number;
};

export function PlansFilterSheet({
  visible,
  onClose,
  isPremium,
  initial,
  onApply,
  onUpgrade,
  baseRadiusKm,
}: Props) {
  const [maxKm, setMaxKm] = useState(initial.maxDistanceKm);
  const [maxPrice, setMaxPrice] = useState(initial.maxPriceCents ?? 0);
  const [verifiedOnly, setVerifiedOnly] = useState(initial.verifiedHostsOnly);

  useEffect(() => {
    if (visible) {
      setMaxKm(initial.maxDistanceKm);
      setMaxPrice(initial.maxPriceCents ?? 0);
      setVerifiedOnly(initial.verifiedHostsOnly);
    }
  }, [visible, initial]);

  function apply() {
    onApply({
      maxDistanceKm: maxKm,
      maxPriceCents: maxPrice > 0 ? maxPrice : null,
      verifiedHostsOnly: isPremium ? verifiedOnly : false,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Filters</Text>
          <Text style={styles.label}>Max distance · {Math.round(maxKm)} km</Text>
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={Math.max(100, baseRadiusKm, maxKm)}
            step={1}
            value={maxKm}
            onValueChange={setMaxKm}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />

          {!isPremium ? (
            <Pressable style={styles.upsell} onPress={onUpgrade}>
              <Text style={styles.upsellTitle}>Unlock price & verified filters</Text>
              <Text style={styles.upsellBody}>Premium members can filter by budget and verified hosts only.</Text>
              <Text style={styles.upsellCta}>See Premium →</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.label}>Max price (approx.) · {maxPrice > 0 ? `${(maxPrice / 100).toFixed(0)}` : 'Any'}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={50000}
                step={500}
                value={maxPrice}
                onValueChange={setMaxPrice}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <View style={styles.row}>
                <Text style={styles.switchLabel}>Verified hosts only</Text>
                <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{ true: colors.primary }} />
              </View>
            </>
          )}

          <Button title="Apply" onPress={apply} />
          <Button title="Close" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  slider: { width: '100%', height: 40, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  upsell: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#F5F3FF',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  upsellTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  upsellBody: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  upsellCta: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: spacing.sm },
});
