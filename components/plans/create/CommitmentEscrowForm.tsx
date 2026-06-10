/**
 * Step 2 — paid / free, escrow pattern, price, split slider (pattern B/C tier gates).
 */
import { Input, onboardingInputShadow } from '@/components/Input';
import { EscrowTrustExplainerCard } from '@/components/plans/create/EscrowTrustExplainerCard';
import { FundingPatternCard } from '@/components/plans/create/FundingPatternCard';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { budgetTierFromNgn } from '@/lib/plans/budgetTierFromPrice';
import { checkPermission } from '@/lib/subscription/checkPermission';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { EscrowPattern } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

const PATTERNS: {
  id: EscrowPattern;
  label: string;
  sub: string;
  icon: IconName;
  tierBadge?: SubscriptionTier;
}[] = [
  { id: 'A', label: 'Host funds', sub: 'You back the invite', icon: 'wallet-outline' },
  { id: 'B', label: 'Split', sub: 'Both contribute equally', icon: 'git-branch-outline', tierBadge: 'SILVER' },
  { id: 'C', label: 'Guest funds', sub: 'Tier 2 KYC required', icon: 'person-outline', tierBadge: 'GOLD' },
];

function priceHint(ngn: number): string {
  if (!Number.isFinite(ngn) || ngn <= 0) {
    return 'Add an amount — we will size hints from your number.';
  }
  if (ngn < 8000) return 'Coffee & chill plans often land ₦5k–₦12k.';
  if (ngn < 25000) return 'Dinner meetups usually range ₦8k–₦25k.';
  return 'Premium social plans often start ₦10k+ — make sure the story matches the ask.';
}

export function CommitmentEscrowForm() {
  const { draft, setDraft } = usePlanDraft();
  const { user, dbUser } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('escrow.pattern_b');
  const [upgradeTier, setUpgradeTier] = useState<SubscriptionTier>('SILVER');
  const [patternCAlert, setPatternCAlert] = useState(false);

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

  async function onSelectPattern(id: EscrowPattern) {
    if (!user?.id) return;

    if (id === 'B') {
      const perm = await checkPermission(user.id, 'escrow.pattern_b');
      if (!perm.allowed) {
        setUpgradeFeature('escrow.pattern_b');
        setUpgradeTier('SILVER');
        setUpgradeOpen(true);
        setDraft((d) => ({ ...d, escrowPattern: 'A' }));
        return;
      }
    }

    if (id === 'C') {
      const perm = await checkPermission(user.id, 'escrow.pattern_c');
      if (!perm.allowed) {
        setUpgradeFeature('escrow.pattern_c');
        setUpgradeTier('GOLD');
        setUpgradeOpen(true);
        setDraft((d) => ({ ...d, escrowPattern: 'A' }));
        setPatternCAlert(false);
        return;
      }
      const kycTier = dbUser?.kyc_tier ?? 1;
      if (kycTier < 2) {
        setPatternCAlert(true);
        setDraft((d) => ({ ...d, escrowPattern: 'A' }));
        return;
      }
      setPatternCAlert(false);
    } else {
      setPatternCAlert(false);
    }

    setDraft((d) => ({ ...d, escrowPattern: id }));
  }

  const ngn = draft.startingPrice.trim() ? Number(draft.startingPrice) : NaN;

  return (
    <View style={styles.wrap}>
      <UpgradePrompt
        visible={upgradeOpen}
        feature={upgradeFeature}
        requiredTier={upgradeTier}
        onUpgrade={() => {
          setUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />

      <Text style={styles.lead}>Commitment & plan security</Text>
      <Text style={styles.sublead}>Secure commitment reduces flakes and builds trust — you stay in control of free vs paid.</Text>

      <EscrowTrustExplainerCard />

      <View style={styles.paidToggleCard}>
        <View style={styles.paidToggleText}>
          <Text style={styles.sectionLabel}>Paid plan</Text>
          <Text style={styles.hint}>Free skips price and escrow for this meetup.</Text>
        </View>
        <Switch
          value={draft.isPaid}
          onValueChange={(v) => setDraft((d) => ({ ...d, isPaid: v }))}
          trackColor={{ true: colors.primary, false: '#D8DCE6' }}
          thumbColor={draft.isPaid ? '#fff' : '#f4f4f5'}
        />
      </View>

      {draft.isPaid ? (
        <>
          <View style={styles.fundingSection}>
            <Text style={styles.sectionLabel}>Who funds commitment?</Text>
            <Text style={styles.fundingHint}>Choose how escrow is funded before your meetup.</Text>
            <View style={styles.patternList}>
              {PATTERNS.map((p) => (
                <FundingPatternCard
                  key={p.id}
                  title={p.label}
                  description={p.sub}
                  icon={p.icon}
                  tierBadge={p.tierBadge}
                  selected={draft.escrowPattern === p.id}
                  onPress={() => void onSelectPattern(p.id)}
                />
              ))}
            </View>
          </View>

          {patternCAlert ? (
            <View style={styles.patternCAlert}>
              <Ionicons name="information-circle-outline" size={18} color="#B45309" />
              <Text style={styles.patternCAlertTxt}>
                Pattern C requires Tier 2 identity verification. Your plan will use Pattern A until Tier 2 is complete.
              </Text>
            </View>
          ) : null}

          {draft.escrowPattern === 'B' ? (
            <View style={styles.splitBlock}>
              <View style={styles.splitHeader}>
                <Ionicons name="git-branch-outline" size={18} color={colors.primary} />
                <Text style={styles.splitTitle}>Split ratio</Text>
              </View>
              <Text style={styles.splitValue}>Your share: {(draft.hostContributionBps / 100).toFixed(0)}%</Text>
              <Text style={styles.splitHint}>Guest pays the remainder — both must fund on the escrow screen.</Text>
              <Slider
                style={styles.slider}
                minimumValue={1000}
                maximumValue={9000}
                step={500}
                value={draft.hostContributionBps}
                onValueChange={(v) => setDraft((d) => ({ ...d, hostContributionBps: Math.round(v) }))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="#D8DCE6"
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

const FIELD_BORDER = '#D8DCE6';

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  lead: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.3, marginBottom: 6 },
  sublead: { fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.md, fontWeight: '600' },
  paidToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    ...onboardingInputShadow,
  },
  paidToggleText: { flex: 1, paddingRight: spacing.sm },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, fontWeight: '600' },
  fundingSection: { marginBottom: spacing.sm },
  fundingHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm, fontWeight: '600' },
  patternList: { gap: spacing.sm },
  splitBlock: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    ...onboardingInputShadow,
  },
  splitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  splitTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  splitValue: { fontSize: 15, fontWeight: '900', color: colors.primary, marginBottom: 4 },
  splitHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted, lineHeight: 17, marginBottom: spacing.sm },
  patternCAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  patternCAlertTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E', lineHeight: 18 },
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
