/**
 * LinkUp KYC — 7-step verification (inbox-grade shell).
 */
import { Button } from '@/components/Button';
import { DocumentSelectionScreen } from '@/components/kyc/DocumentSelectionScreen';
import { KycLeadBlock } from '@/components/kyc/KycLeadBlock';
import { KycSectionHead } from '@/components/kyc/KycSectionHead';
import { KycShell } from '@/components/kyc/KycShell';
import { kycColors, kycCtaShadow, kycInboxStyles, kycStyles } from '@/components/kyc/kycTheme';
import { K2IdCapture } from '@/components/kyc/steps/K2IdCapture';
import { K3Liveness } from '@/components/kyc/steps/K3Liveness';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { clearKycDraft, loadKycDraft, saveKycDraft } from '@/lib/verification/kycDraftStorage';
import {
  fetchLatestVerificationRequest,
  submitVerificationBundle,
} from '@/lib/verification/submitVerification';
import type { KycDocumentType, KycStepNumber } from '@/types/kyc';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BULLET = '\u2713';

export default function KycWizardScreen() {
  const insets = useSafeAreaInsets();
  const { user, dbUser, refreshProfile } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<KycStepNumber>(1);
  const [documentType, setDocumentType] = useState<KycDocumentType | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  const persistDraft = useCallback(async () => {
    if (!user?.id) return;
    if (step >= 1 && step <= 5) {
      await saveKycDraft(user.id, {
        draftVersion: 2,
        step,
        documentType,
        countryCode,
        idImageUri: idUri,
        videoUri,
      });
    }
  }, [user?.id, step, documentType, countryCode, idUri, videoUri]);

  useEffect(() => {
    void persistDraft();
  }, [persistDraft]);

  useEffect(() => {
    if (!hydrated) return;
    if ((step === 3 || step === 4) && documentType == null) {
      setStep(2);
    }
  }, [hydrated, step, documentType]);

  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;
    (async () => {
      if (dbUser?.verification_status === 'verified') {
        if (!cancel) {
          setStep(7);
          setHydrated(true);
        }
        return;
      }
      if (dbUser?.verification_status === 'pending') {
        if (!cancel) {
          setStep(6);
          setHydrated(true);
        }
        return;
      }
      if (dbUser?.verification_status === 'rejected') {
        const req = await fetchLatestVerificationRequest(user.id);
        if (!cancel) {
          setRejectReason(req?.rejection_reason ?? 'Please upload clearer photos and try again.');
          setStep(7);
          setHydrated(true);
        }
        return;
      }
      const draft = await loadKycDraft(user.id);
      if (!cancel && draft && draft.step >= 1 && draft.step <= 5) {
        setStep(draft.step);
        setDocumentType(draft.documentType);
        setCountryCode(draft.countryCode);
        setIdUri(draft.idImageUri);
        setVideoUri(draft.videoUri);
      }
      if (!cancel) setHydrated(true);
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, dbUser?.verification_status]);

  async function onSubmitConsent() {
    if (!user?.id || !idUri || !videoUri || !documentType) {
      Alert.alert('Almost there', 'Choose your ID type, add your document photo, and record your video first.');
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please confirm how we use your verification data.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Setup', 'Configure Supabase in .env');
      return;
    }
    setBusy(true);
    const { error } = await submitVerificationBundle({
      userId: user.id,
      idLocalUri: idUri,
      videoLocalUri: videoUri,
      countryCode,
      documentType,
      consentAtIso: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      Alert.alert('Upload failed', error.message + '\n\nCheck your connection and try again.');
      return;
    }
    await clearKycDraft(user.id);
    await refreshProfile();
    setStep(6);
  }

  function onRetryRejected() {
    setRejectReason(null);
    setIdUri(null);
    setVideoUri(null);
    setConsent(false);
    setDocumentType(null);
    setStep(2);
  }

  function exitToApp() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  if (!user) {
    return (
      <KycShell step={1} onClose={exitToApp} showProgress={false}>
        <View style={styles.center}>
          <ActivityIndicator color={kycColors.primary} size="large" />
        </View>
      </KycShell>
    );
  }

  if (!hydrated) {
    return (
      <KycShell step={step} onClose={exitToApp}>
        <View style={styles.center}>
          <ActivityIndicator color={kycColors.primary} size="large" />
          <Text style={styles.hint}>Loading your progress…</Text>
        </View>
      </KycShell>
    );
  }

  const showProgress = step >= 1 && step <= 5;

  return (
    <KycShell step={step} onClose={exitToApp} showProgress={showProgress}>
      {step === 1 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={kycInboxStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <KycLeadBlock
            kicker="Trust & safety"
            title="Build trust together"
            subtitle="A quick check unlocks messaging, meetups, and optional paid hangouts with escrow — so connections stay human, not risky."
          />
          <KycSectionHead title="Why verify" />
          <View style={kycInboxStyles.frostedCard}>
            <View style={kycStyles.bullets}>
              <View style={kycStyles.bulletRow}>
                <Text style={kycStyles.bullet}>{BULLET}</Text>
                <Text style={kycStyles.bulletText}>Share meetup ideas with confidence</Text>
              </View>
              <View style={kycStyles.bulletRow}>
                <Text style={kycStyles.bullet}>{BULLET}</Text>
                <Text style={kycStyles.bulletText}>Chat and plan with people who&apos;ve verified</Text>
              </View>
              <View style={kycStyles.bulletRow}>
                <Text style={kycStyles.bullet}>{BULLET}</Text>
                <Text style={kycStyles.bulletText}>Optional secure escrow when money is part of the plan</Text>
              </View>
            </View>
          </View>
          <View style={[kycInboxStyles.frostedCard, { marginTop: 0 }]}>
            <Text style={styles.cardNote}>
              Your ID and short clip stay private — used only to confirm you&apos;re you, like checks you&apos;d
              expect from a bank or travel app.
            </Text>
          </View>
          <Pressable
            onPress={() => setStep(2)}
            style={({ pressed }) => [styles.ctaOuter, kycCtaShadow, pressed && styles.ctaPressed]}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <DocumentSelectionScreen
          selected={documentType}
          onSelect={setDocumentType}
          onContinue={() => {
            if (documentType == null) return;
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && documentType != null && (
        <K2IdCapture
          documentType={documentType}
          countryCode={countryCode}
          onCountryChange={setCountryCode}
          idUri={idUri}
          onIdChange={setIdUri}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <K3Liveness
          videoUri={videoUri}
          onVideoChange={setVideoUri}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={kycInboxStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <KycLeadBlock
            kicker="Final step"
            title="Consent"
            subtitle="We use your ID and video only to verify identity, prevent fraud, and comply with law — never on your public profile."
          />
          <Pressable
            style={[styles.checkRow, consent && styles.checkRowOn]}
            onPress={() => setConsent((c) => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
          >
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.checkLabel}>
              I agree to LinkUp processing my verification documents as described in the Privacy Policy.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void onSubmitConsent()}
            disabled={!consent || busy}
            style={({ pressed }) => [
              styles.ctaOuter,
              kycCtaShadow,
              (!consent || busy) && { opacity: 0.55 },
              pressed && consent && !busy && styles.ctaPressed,
            ]}
          >
            <LinearGradient
              colors={!consent || busy ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaTxt}>Submit for review</Text>
              )}
            </LinearGradient>
          </Pressable>
          <Button title="Back" variant="ghost" onPress={() => setStep(4)} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      )}

      {step === 6 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={kycInboxStyles.scrollContent}>
          <KycLeadBlock
            kicker="Almost there"
            title="Verification in progress"
            subtitle="Our team usually reviews within a few hours. Keep browsing — we'll notify you when it's done."
          />
          <View style={kycInboxStyles.frostedCard}>
            <Text style={styles.eta}>Estimated time: under 24 hours</Text>
            <Text style={styles.etaMuted}>
              Some cases take a little longer — we&apos;ll let you know if we need more detail.
            </Text>
          </View>
          <Pressable
            onPress={exitToApp}
            style={({ pressed }) => [styles.ctaOuter, kycCtaShadow, pressed && styles.ctaPressed]}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaTxt}>Back to LinkUp</Text>
            </LinearGradient>
          </Pressable>
          <Button
            title="Refresh status"
            variant="ghost"
            onPress={() => void refreshProfile()}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      )}

      {step === 7 && dbUser?.verification_status === 'verified' && (
        <View style={styles.step7Root}>
          <View style={styles.step7Top}>
            <KycLeadBlock
              kicker="Verified"
              title="You're all set"
              subtitle="Your badge helps people feel at ease meeting you. Chat freely and use optional escrow when money's part of the plan."
            />
          </View>
          <View style={styles.step7Middle}>
            <LinearGradient
              colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successRing}
            >
              <View style={styles.successCard}>
                <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.successIconGrad}>
                  <Ionicons name="checkmark-circle" size={40} color="#fff" />
                </LinearGradient>
                <Text style={styles.successTxt}>Trust unlocked</Text>
                <Text style={styles.successHint}>Thanks for helping keep LinkUp a safer place to connect.</Text>
              </View>
            </LinearGradient>
          </View>
          <View style={[styles.step7Footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGrad}
              >
                <Text style={styles.ctaTxt}>Continue</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      )}

      {step === 7 && dbUser?.verification_status === 'rejected' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={kycInboxStyles.scrollContent}>
          <KycLeadBlock
            kicker="Try again"
            title="Needs another look"
            subtitle="We couldn't confirm your documents this time — often lighting or glare hides details."
          />
          <View style={[kycInboxStyles.frostedCard, styles.rejectCard]}>
            <Text style={styles.rejectLabel}>Reason</Text>
            <Text style={styles.rejectBody}>{rejectReason ?? 'Please try again with clearer images.'}</Text>
          </View>
          <Pressable
            onPress={onRetryRejected}
            style={({ pressed }) => [styles.ctaOuter, kycCtaShadow, pressed && styles.ctaPressed]}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaTxt}>Try again</Text>
            </LinearGradient>
          </Pressable>
          <Button title="Back to LinkUp" variant="ghost" onPress={exitToApp} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      )}
    </KycShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { marginTop: spacing.sm, color: kycColors.muted, fontWeight: '600' },
  cardNote: { fontSize: 14, color: kycColors.muted, lineHeight: 22, fontWeight: '600' },
  ctaOuter: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  ctaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  ctaGrad: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  ctaTxt: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    backgroundColor: colors.surface,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  checkRowOn: { borderColor: colors.primary, backgroundColor: 'rgba(108, 99, 255, 0.06)' },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: kycColors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: kycColors.primary, borderColor: kycColors.primary },
  checkLabel: { flex: 1, fontSize: 15, color: kycColors.text, lineHeight: 22, fontWeight: '600' },
  eta: { fontSize: 17, fontWeight: '800', color: kycColors.text },
  etaMuted: { marginTop: spacing.sm, fontSize: 14, color: kycColors.muted, lineHeight: 20, fontWeight: '600' },
  step7Root: { flex: 1, paddingHorizontal: spacing.md },
  step7Top: { paddingTop: spacing.xs },
  step7Middle: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    minHeight: 160,
  },
  step7Footer: { paddingTop: spacing.lg },
  successRing: {
    borderRadius: radius.xl + 2,
    padding: 2,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  successIconGrad: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTxt: { fontSize: 19, fontWeight: '900', color: kycColors.text, textAlign: 'center' },
  successHint: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: kycColors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    fontWeight: '600',
  },
  rejectCard: { borderLeftWidth: 4, borderLeftColor: kycColors.secondary },
  rejectLabel: { fontSize: 12, fontWeight: '900', color: kycColors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  rejectBody: { marginTop: spacing.sm, fontSize: 16, color: kycColors.text, lineHeight: 24, fontWeight: '600' },
});
