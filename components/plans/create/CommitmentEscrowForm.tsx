/**
 * Step 2 — paid / free, escrow pattern, price, split slider (pattern B).
 */
import { Input } from '@/components/Input';
import { EscrowTrustExplainerCard } from '@/components/plans/create/EscrowTrustExplainerCard';
import { GradientSelectionChip } from '@/components/ui/GradientSelectionChip';
import { colors, radius, spacing } from '@/constants/theme';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { budgetTierFromNgn } from '@/lib/plans/budgetTierFromPrice';
import type { EscrowPattern } from '@/types/database';
import Slider from '@react-native-community/slider';
import { useEffect } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

const PATTERNS: { id: EscrowPattern; label: string; sub: string }[] = [
  { id: 'A', label: 'Host funds', sub: 'You back the invite' },
  { id: 'B', label: 'Split', sub: 'Both contribute' },
  { id: 'C', label: 'Guest funds', sub: 'Tier 2 KYC' },
];

function PatternChip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <GradientSelectionChip selected={selected} onPress={onPress} style={styles.patternChipOuter}>
      <Text style={[styles.patternLabel, selected && styles.patternLabelOn]}>{label}</Text>
      <Text style={[styles.patternSub, selected && styles.patternSubOn]}>{sub}</Text>
    </GradientSelectionChip>
  );
}

function priceHint(ngn: number): string {
  if (!Number.isFinite(ngn) || ngn <= 0) {
    return 'Add an amount — we’ll size hints from your number.';
  }
  if (ngn < 8000) return 'Coffee & chill plans often land ₦5k–₦12k.';
  if (ngn < 25000) return 'Dinner meetups usually range ₦8k–₦25k.';
  return 'Premium social plans often start ₦10k+ — make sure the story matches the ask.';
}

export function CommitmentEscrowForm() {
  const { draft, setDraft } = usePlanDraft();

  useEffect(() => {
    setDraft((d) => {
      if (!d.isPaid) {
        return d.escrowPattern == null ? d : { ...d, escrowPattern: null };
      }
      if (!d.escrowPattern) {
        return { ...d, escrowPattern: 'A' };
      }
      return d;
    });
  }, [setDraft, draft.isPaid]);

  useEffect(() => {
    setDraft((d) => {
      if (!d.isPaid) {
        return d.budgetTier == null ? d : { ...d, budgetTier: null };
      }
      const ngn = d.startingPrice.trim() ? Number(d.startingPrice) : NaN;
      if (Number.isNaN(ngn) || ngn <= 0) {
        return d.budgetTier == null ? d : { ...d, budgetTier: null };
      }
      const tier = budgetTierFromNgn(ngn);
      return d.budgetTier === tier ? d : { ...d, budgetTier: tier };
    });
  }, [setDraft, draft.startingPrice, draft.isPaid]);

  const ngn = draft.startingPrice.trim() ? Number(draft.startingPrice) : NaN;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Commitment & plan security</Text>
      <Text style={styles.sublead}>Secure commitment reduces flakes and builds trust — you stay in control of free vs paid.</Text>

      <EscrowTrustExplainerCard />

      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.sectionLabel}>Paid plan</Text>
          <Text style={styles.hint}>Free skips price and escrow for this meetup.</Text>
        </View>
        <Switch
          value={draft.isPaid}
          onValueChange={(v) => setDraft((d) => ({ ...d, isPaid: v }))}
          trackColor={{ true: colors.primary, false: '#ccc' }}
        />
      </View>

      {draft.isPaid ? (
        <>
          <Text style={styles.sectionLabel}>Who funds commitment?</Text>
          <View style={styles.patternRow}>
            {PATTERNS.map((p) => (
              <PatternChip
                key={p.id}
                label={p.label}
                sub={p.sub}
                selected={draft.escrowPattern === p.id}
                onPress={() => setDraft((d) => ({ ...d, escrowPattern: p.id }))}
              />
            ))}
          </View>

          {draft.escrowPattern === 'B' ? (
            <View style={styles.splitBlock}>
              <Text style={styles.hint}>Your share: {(draft.hostContributionBps / 100).toFixed(0)}%</Text>
              <Slider
                style={styles.slider}
                minimumValue={1000}
                maximumValue={9000}
                step={500}
                value={draft.hostContributionBps}
                onValueChange={(v) => setDraft((d) => ({ ...d, hostContributionBps: Math.round(v) }))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
              />
            </View>
          ) : null}

          <Input
            label="Commitment amount (NGN)"
            variant="onboardingFlat"
            keyboardType="decimal-pad"
            value={draft.startingPrice}
            onChangeText={(t) => setDraft((d) => ({ ...d, startingPrice: t }))}
            placeholder="e.g. 15000"
          />
          <View style={styles.hintCard}>
            <Text style={styles.hintStrong}>Smart hint</Text>
            <Text style={styles.hintCardTxt}>{priceHint(ngn)}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  lead: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 6 },
  sublead: { fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  patternRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  patternChipOuter: { flexGrow: 1, minWidth: '30%' },
  patternLabel: { fontWeight: '800', color: colors.text, fontSize: 13 },
  patternLabelOn: { color: '#fff' },
  patternSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  patternSubOn: { color: 'rgba(255,255,255,0.92)' },
  splitBlock: { marginBottom: spacing.md },
  slider: { width: '100%', height: 40 },
  hintCard: {
    backgroundColor: '#F8F7FF',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.18)',
    marginTop: spacing.sm,
  },
  hintStrong: { fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  hintCardTxt: { fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '600' },
});
