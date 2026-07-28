import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  planId: string;
  visible: boolean;
  onCancelled: () => void;
  onDismiss: () => void;
};

type Step = 'reason' | 'confirm';

type CancellationTerms = {
  hours_until_meetup: number;
  canceller_refund_percent: number;
  other_party_penalty_percent: number;
  other_party_goodwill_credit: string;
  trust_strikes: number;
  visibility_reduction_percent: number;
  visibility_reduction_days: number;
  creation_hold_days: number;
  requires_admin_review: boolean;
};

const REASON_OPTIONS = [
  { value: 'logistical_issue', label: 'Logistical issue' },
  { value: 'personal_emergency', label: 'Personal emergency' },
  { value: 'insufficient_group_size', label: 'Insufficient group size' },
  { value: 'venue_issue', label: 'Venue issue' },
  { value: 'other', label: 'Other' },
] as const;

export function GroupHostCancellationModal({ planId, visible, onCancelled, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('reason');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [terms, setTerms] = useState<CancellationTerms | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetAndDismiss = () => {
    setStep('reason');
    setReasonType('');
    setReasonText('');
    setTerms(null);
    onDismiss();
  };

  const handleReasonContinue = async () => {
    if (!reasonType) return;
    if (reasonType === 'other' && !reasonText.trim()) return;
    setIsLoading(true);
    const { data, error } = await supabase.rpc('get_cancellation_terms', {
      p_plan_id: planId,
      p_cancelling_party: 'host',
    });
    setIsLoading(false);
    if (error) {
      Alert.alert('Error', 'Could not load cancellation terms. Please try again.');
      return;
    }
    setTerms(data as CancellationTerms);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-group-host-cancellation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          reason_type: reasonType,
          reason_text: reasonText.trim() || undefined,
        }),
      }
    );
    setIsLoading(false);
    if (res.ok) {
      onCancelled();
    } else {
      const data = (await res.json()) as { error?: string };
      Alert.alert('Cancellation failed', data.error || 'Please try again.');
    }
  };

  const canContinue =
    !!reasonType && (reasonType !== 'other' || reasonText.trim().length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndDismiss}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.handle} />

          {step === 'reason' ? (
            <>
              <Text style={styles.title}>Cancel Group Plan</Text>
              <Text style={styles.body}>Please select a reason for cancelling this plan.</Text>
              {REASON_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.option, reasonType === opt.value && styles.optionSelected]}
                  onPress={() => setReasonType(opt.value)}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      reasonType === opt.value && styles.optionLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
              {reasonType === 'other' ? (
                <TextInput
                  style={styles.textArea}
                  value={reasonText}
                  onChangeText={setReasonText}
                  placeholder="Please describe the reason for cancellation."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : null}
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Pressable
                  style={[styles.primaryOuter, !canContinue && styles.disabled]}
                  onPress={() => void handleReasonContinue()}
                  disabled={!canContinue}
                >
                  <LinearGradient
                    colors={[colors.primary, '#8B7CF8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGradient}
                  >
                    <Text style={styles.primaryLabel}>Continue</Text>
                  </LinearGradient>
                </Pressable>
              )}
              <Pressable style={styles.secondaryButton} onPress={resetAndDismiss}>
                <Text style={styles.secondaryLabel}>Go back</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'confirm' && terms ? (
            <>
              <Text style={styles.title}>Confirm cancellation</Text>
              <Text style={styles.body}>
                Cancelling now ({terms.hours_until_meetup} hours before the meetup) means the
                following will apply:
              </Text>

              <View style={styles.consequenceCard}>
                <View style={styles.consequenceRow}>
                  <Text style={styles.consequenceLabel}>Your refund</Text>
                  <Text style={styles.consequenceValue}>
                    {terms.canceller_refund_percent}% of your contribution
                  </Text>
                </View>
                <View style={styles.consequenceRow}>
                  <Text style={styles.consequenceLabel}>Guest compensation</Text>
                  <Text style={styles.consequenceValue}>
                    {terms.other_party_penalty_percent}% distributed proportionally
                  </Text>
                </View>
                {terms.other_party_goodwill_credit !== 'none' ? (
                  <View style={styles.consequenceRow}>
                    <Text style={styles.consequenceLabel}>Goodwill credits</Text>
                    <Text style={styles.consequenceValue}>
                      {terms.other_party_goodwill_credit === 'enhanced' ? 'Enhanced' : 'Standard'}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.consequenceRow}>
                  <Text style={styles.consequenceLabel}>Trust impact</Text>
                  <Text style={[styles.consequenceValue, styles.consequenceValueRed]}>
                    {terms.trust_strikes} strike{terms.trust_strikes !== 1 ? 's' : ''}
                    {terms.visibility_reduction_percent > 0
                      ? `, ${terms.visibility_reduction_percent}% visibility for ${terms.visibility_reduction_days} days`
                      : ''}
                    {terms.creation_hold_days > 0 ? `, ${terms.creation_hold_days}-day hold` : ''}
                    {terms.requires_admin_review ? ', admin review' : ''}
                  </Text>
                </View>
              </View>

              <Text style={styles.caption}>
                All guest contributions will be refunded immediately. This action cannot be undone.
              </Text>

              {isLoading ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Pressable style={styles.destructiveOuter} onPress={() => void handleConfirm()}>
                    <Text style={styles.destructiveLabel}>Confirm cancellation</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => setStep('reason')}>
                    <Text style={styles.secondaryLabel}>Go back</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    alignSelf: 'center',
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  option: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(94,82,255,0.08)',
  },
  optionLabel: {
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.medium,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  textArea: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text,
    minHeight: 96,
    fontFamily: fonts.regular,
  },
  consequenceCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.06)',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  consequenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  consequenceLabel: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.medium,
  },
  consequenceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bold,
  },
  consequenceValueRed: { color: colors.danger },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  primaryOuter: { borderRadius: radius.button, overflow: 'hidden' },
  primaryGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  destructiveOuter: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.danger,
  },
  destructiveLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  disabled: { opacity: 0.4 },
});
