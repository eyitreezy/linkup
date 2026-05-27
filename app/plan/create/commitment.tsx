/**
 * Create plan — Step 2: commitment, escrow, smart hints.
 */
import { CommitmentEscrowForm } from '@/components/plans/create/CommitmentEscrowForm';
import { CreatePlanStickyProgress } from '@/components/plans/create/CreatePlanProgressBar';
import { CreatePlanWizardBack } from '@/components/plans/create/CreatePlanWizardBack';
import { CreatePlanWizardFooter } from '@/components/plans/create/CreatePlanWizardFooter';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import { requiresVerificationGate } from '@/lib/verification/access';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

export default function CreatePlanCommitmentScreen() {
  const { draft } = usePlanDraft();
  const { dbUser, isAdmin, profile } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  function next() {
    if (!draft.meetTypeId || !draft.scheduledAt) {
      Alert.alert('Go back', 'Finish meet type and time on step 1.');
      router.back();
      return;
    }
    if (draft.isPaid) {
      const cents = draft.startingPrice.trim() ? Math.round(Number(draft.startingPrice) * 100) : 0;
      if (!draft.startingPrice.trim() || Number.isNaN(Number(draft.startingPrice))) {
        Alert.alert('Amount', 'Enter a commitment amount in NGN.');
        return;
      }
      if (cents < MIN_ESCROW_CENTS) {
        Alert.alert('Amount', `Minimum paid plan is ₦${MIN_ESCROW_CENTS / 100}.`);
        return;
      }
      if (!draft.escrowPattern) {
        Alert.alert('Funding', 'Choose who funds the commitment.');
        return;
      }
    }
    router.push('/plan/create/details');
  }

  function onNext() {
    if (
      requiresVerificationGate(dbUser?.verification_status, {
        isAdmin,
        verifiedBadge: profile?.verified_badge,
      })
    ) {
      setGateOpen(true);
      return;
    }
    next();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false} safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenBg}>
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={['#EDE8FF', '#FFF5F8', '#FDF2F8', colors.background]}
            locations={[0, 0.3, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <VerificationHardGateModal
            visible={gateOpen}
            onClose={() => setGateOpen(false)}
            verificationStatus={dbUser?.verification_status}
          />
          <CreatePlanStickyProgress current={1} />
          <CreatePlanWizardBack />
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            <View style={styles.hero}>
              <LinearGradient
                colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGrad}
              >
                <Text style={styles.heroKicker}>Trust-first</Text>
                <Text style={styles.heroTitle}>Commitment & plan security</Text>
                <Text style={styles.heroSub}>
                  Bumble-clear structure · escrow stays exactly as before, just easier to understand.
                </Text>
              </LinearGradient>
            </View>
            <CommitmentEscrowForm />
          </ScrollView>
          <CreatePlanWizardFooter onPress={onNext} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenBg: { backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 120, paddingTop: spacing.sm },
  hero: { marginBottom: spacing.md, borderRadius: radius.xl, overflow: 'hidden' },
  heroGrad: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  heroSub: { fontSize: 15, color: colors.textMuted, marginTop: 8, lineHeight: 22, fontWeight: '600' },
});
