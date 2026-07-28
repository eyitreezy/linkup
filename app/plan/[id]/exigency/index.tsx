import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { EXIGENCY_EVIDENCE_NDPR } from '@/lib/plans/policySignOffContent';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Step = 'reason_type' | 'description' | 'evidence' | 'confirm';

const REASON_OPTIONS = [
  { value: 'late_arrival', label: 'I arrived but after the confirmation window' },
  { value: 'illness', label: 'Illness or medical emergency' },
  { value: 'accident', label: 'Accident or injury' },
  { value: 'emergency', label: 'Other emergency (flood, family crisis, etc.)' },
  { value: 'transport', label: 'Transport or venue issue' },
  { value: 'other', label: 'Other reason' },
] as const;

export default function ExigencyReportScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('reason_type');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!planId || !user?.id) return;
    setIsSubmitting(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not signed in');

      const formData = new FormData();
      formData.append('plan_id', planId);
      formData.append('reason_type', reasonType);
      formData.append('reason_text', reasonText);
      if (evidenceUri) {
        formData.append('evidence', {
          uri: evidenceUri,
          type: 'image/jpeg',
          name: 'evidence.jpg',
        } as unknown as Blob);
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-exigency-report`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );
      const data = (await res.json()) as { error?: string; review_hours?: number };
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      router.replace(`/plan/${planId}/exigency/success`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickEvidence = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEvidenceUri(result.assets[0].uri);
    }
  };

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <AppShellBackground />
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Exigency Report</Text>
        <Text style={styles.subtitle}>
          Tell us why you could not attend. You never lose more than 50% of your contribution in
          Group Plan outcomes.
        </Text>

        {step === 'reason_type' ? (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Why were you unable to attend?</Text>
            {REASON_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.optionCard, reasonType === opt.value && styles.optionCardSelected]}
                onPress={() => setReasonType(opt.value)}
              >
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </Pressable>
            ))}
            <PrimaryBtn
              label="Continue"
              disabled={!reasonType}
              onPress={() => reasonType && setStep('description')}
            />
          </View>
        ) : null}

        {step === 'description' ? (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Describe what happened</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Please describe the circumstances in detail. More detail helps your case."
              placeholderTextColor={colors.textMuted}
              value={reasonText}
              onChangeText={setReasonText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <PrimaryBtn
              label="Continue"
              disabled={reasonText.length < 20}
              onPress={() => reasonText.length >= 20 && setStep('evidence')}
            />
          </View>
        ) : null}

        {step === 'evidence' ? (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Supporting evidence</Text>
            <Text style={styles.bodyText}>
              Upload supporting documentation if available (medical certificate, hospital record, or
              similar). Optional but recommended for illness and emergency claims.
            </Text>
            <Pressable style={styles.secondaryBtn} onPress={() => void pickEvidence()}>
              <Text style={styles.secondaryBtnLabel}>
                {evidenceUri ? 'Evidence selected' : 'Add evidence (optional)'}
              </Text>
            </Pressable>
            <Text style={styles.ndprText}>{EXIGENCY_EVIDENCE_NDPR}</Text>
            <PrimaryBtn
              label={evidenceUri ? 'Continue with evidence' : 'Continue without evidence'}
              onPress={() => setStep('confirm')}
            />
          </View>
        ) : null}

        {step === 'confirm' ? (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Review and submit</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Reason</Text>
              <Text style={styles.summaryValue}>
                {REASON_OPTIONS.find((o) => o.value === reasonType)?.label}
              </Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PrimaryBtn
              label="Submit Exigency Report"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
            />
            <Text style={styles.caption}>
              Force majeure reports are reviewed within 72 hours. Other reports within 48 hours.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PrimaryBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryOuter, disabled && styles.primaryDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <LinearGradient
        colors={disabled ? [colors.border, colors.border] : [colors.primary, '#8B7CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryGradient}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryLabel}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  backBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.12)',
  },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
    marginBottom: spacing.lg,
  },
  step: { gap: spacing.md },
  stepTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(94,82,255,0.08)',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  secondaryBtn: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.secondary,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  ndprText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  primaryOuter: { borderRadius: 50, overflow: 'hidden', marginTop: spacing.sm },
  primaryDisabled: { opacity: 0.6 },
  primaryGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
