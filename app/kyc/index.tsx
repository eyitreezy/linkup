/**
 * LinkUp KYC — 7-step verification (trust intro → document type → ID → liveness → consent → queue → outcome).
 */
import { Button } from '@/components/Button';
import { DocumentSelectionScreen } from '@/components/kyc/DocumentSelectionScreen';
import { KycProgressBar } from '@/components/kyc/KycProgressBar';
import { kycColors, kycStyles } from '@/components/kyc/kycTheme';
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
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
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

  /**
   * Avoid stacking SafeAreaView padding + negative margin (often no visible change). Use one explicit top inset,
   * trimmed so the Close row sits tighter under the status bar / cutout. Android: hook top is sometimes 0 while
   * StatusBar.currentHeight still reflects the real bar.
   */
  const statusBarPad = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const topInset = Math.max(insets.top, statusBarPad);
  const kycTopPadding = Math.max(topInset - spacing.xl, spacing.sm);

  if (!user) {
    return (
      <View style={[kycStyles.screen, styles.center]}>
        <ActivityIndicator color={kycColors.primary} size="large" />
      </View>
    );
  }

  if (!hydrated) {
    return (
      <View style={[kycStyles.screen, styles.center]}>
        <ActivityIndicator color={kycColors.primary} size="large" />
        <Text style={styles.hint}>Loading your progress…</Text>
      </View>
    );
  }

  return (
    <View style={[kycStyles.screen, { paddingTop: kycTopPadding }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={exitToApp} hitSlop={12}>
          <Text style={styles.close}>← Close</Text>
        </Pressable>
        <View style={styles.headerSpacer} />
      </View>
      <KycProgressBar step={step} />

      {step === 1 && (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
          <Text style={kycStyles.title}>Trust center</Text>
          <Text style={kycStyles.subtitle}>
            Verification keeps scammers out and builds real trust. It&apos;s quick — and it unlocks the parts of LinkUp
            where money and meetups meet.
          </Text>
          <View style={kycStyles.bullets}>
            <View style={kycStyles.bulletRow}>
              <Text style={kycStyles.bullet}>{BULLET}</Text>
              <Text style={kycStyles.bulletText}>Create and publish plans confidently</Text>
            </View>
            <View style={kycStyles.bulletRow}>
              <Text style={kycStyles.bullet}>{BULLET}</Text>
              <Text style={kycStyles.bulletText}>Negotiate offers with verified people</Text>
            </View>
            <View style={kycStyles.bulletRow}>
              <Text style={kycStyles.bullet}>{BULLET}</Text>
              <Text style={kycStyles.bulletText}>Use secure escrow for paid meetups</Text>
            </View>
          </View>
          <View style={[kycStyles.card, { marginTop: spacing.md }]}>
            <Text style={styles.cardNote}>
              Your ID and short video are stored privately. We run automated checks (with human review when needed) —
              same pattern as banks and marketplaces.
            </Text>
          </View>
          <Button title="Start verification" onPress={() => setStep(2)} pill style={{ marginTop: spacing.lg }} />
          <Text style={styles.aiNote}>
            AI: face match, liveness, and fraud signals are processed as placeholders until your vendor pipeline is
            wired.
          </Text>
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
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
          <Text style={kycStyles.title}>Consent</Text>
          <Text style={kycStyles.subtitle}>
            We use your ID image and video only to verify your identity, prevent fraud, and comply with law. We don&apos;t
            post them on your profile. You can request deletion when your account closes, subject to legal retention
            rules.
          </Text>
          <Pressable
            style={[styles.checkRow, consent && styles.checkRowOn]}
            onPress={() => setConsent((c) => !c)}
          >
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent ? <Text style={styles.checkmark}>{BULLET}</Text> : null}
            </View>
            <Text style={styles.checkLabel}>
              I agree to LinkUp processing my verification documents as described in the Privacy Policy.
            </Text>
          </Pressable>
          <Button title={busy ? 'Submitting…' : 'Submit for review'} onPress={() => void onSubmitConsent()} loading={busy} disabled={!consent || busy} pill style={{ marginTop: spacing.lg }} />
          <Button title="Back" variant="ghost" onPress={() => setStep(4)} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      )}

      {step === 6 && (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <Text style={kycStyles.title}>Verification in progress</Text>
          <Text style={kycStyles.subtitle}>
            Our team usually reviews submissions within a few hours — sometimes faster. You can keep browsing LinkUp;
            we&apos;ll notify you when it&apos;s done.
          </Text>
          <View style={kycStyles.card}>
            <Text style={styles.eta}>Estimated time: under 24 hours</Text>
            <Text style={styles.etaMuted}>
              Some cases take a little longer — we&apos;ll let you know if we need more detail.
            </Text>
          </View>
          <Button title="Back to LinkUp" onPress={exitToApp} pill style={{ marginTop: spacing.lg }} />
          <Button
            title="Refresh status"
            variant="secondary"
            onPress={() => void refreshProfile()}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      )}

      {step === 7 && dbUser?.verification_status === 'verified' && (
        <View style={styles.step7VerifiedRoot}>
          <View style={styles.step7VerifiedTop}>
            <Text style={kycStyles.title}>You&apos;re verified</Text>
            <Text style={[kycStyles.subtitle, styles.step7VerifiedSubtitle]}>
              Nice — your badge is live. You can create plans, negotiate, and use escrow with full trust features.
            </Text>
          </View>
          <View style={styles.step7VerifiedMiddle}>
            <View style={[kycStyles.card, styles.successCard]}>
              <View style={styles.successIconRing}>
                <Ionicons name="checkmark-circle" size={56} color={kycColors.primary} />
              </View>
              <Text style={styles.successTxt}>Verified on LinkUp</Text>
              <Text style={styles.successHint}>Trust features are unlocked on your account.</Text>
            </View>
          </View>
          <View style={[styles.step7VerifiedFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
            <Button title="Continue" onPress={() => router.replace('/(tabs)')} pill />
          </View>
        </View>
      )}

      {step === 7 && dbUser?.verification_status === 'rejected' && (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <Text style={kycStyles.title}>Needs another look</Text>
          <Text style={kycStyles.subtitle}>
            We couldn&apos;t confirm your documents this time. No worries — it happens when lighting or glare hides
            details.
          </Text>
          <View style={[kycStyles.card, styles.rejectCard]}>
            <Text style={styles.rejectLabel}>Reason</Text>
            <Text style={styles.rejectBody}>{rejectReason ?? 'Please try again with clearer images.'}</Text>
          </View>
          <Button title="Try again" onPress={onRetryRejected} pill />
          <Button title="Back to LinkUp" variant="ghost" onPress={exitToApp} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  hint: { marginTop: spacing.sm, color: kycColors.muted },
  /** Same rhythm as profile onboarding `headerRow` (no extra vertical padding). */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  headerSpacer: { width: 56 },
  close: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardNote: { fontSize: 14, color: kycColors.muted, lineHeight: 22 },
  aiNote: { marginTop: spacing.lg, fontSize: 12, color: kycColors.muted, lineHeight: 18 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: kycColors.surface,
    gap: spacing.md,
  },
  checkRowOn: { borderColor: kycColors.primary },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: kycColors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: kycColors.primary, borderColor: kycColors.primary },
  checkmark: { color: '#fff', fontWeight: '900', fontSize: 14 },
  checkLabel: { flex: 1, fontSize: 15, color: kycColors.text, lineHeight: 22 },
  eta: { fontSize: 17, fontWeight: '700', color: kycColors.text },
  etaMuted: { marginTop: spacing.sm, fontSize: 14, color: kycColors.muted, lineHeight: 20 },
  step7VerifiedRoot: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  step7VerifiedTop: {
    paddingTop: spacing.xs,
  },
  step7VerifiedSubtitle: {
    marginBottom: 0,
  },
  /** Centers the celebration card between copy and the primary CTA so the layout doesn’t feel top-heavy. */
  step7VerifiedMiddle: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    minHeight: 160,
  },
  step7VerifiedFooter: {
    paddingTop: spacing.lg,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl + spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  successIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTxt: { fontSize: 19, fontWeight: '800', color: kycColors.text, textAlign: 'center' },
  successHint: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: kycColors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  rejectCard: { borderLeftWidth: 4, borderLeftColor: kycColors.secondary },
  rejectLabel: { fontSize: 12, fontWeight: '700', color: kycColors.muted, textTransform: 'uppercase' },
  rejectBody: { marginTop: spacing.sm, fontSize: 16, color: kycColors.text, lineHeight: 24 },
});
