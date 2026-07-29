import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REASONS = [
  { value: 'inaccurate', label: 'Inaccurate or misleading' },
  { value: 'abusive', label: 'Abusive or offensive' },
  { value: 'retaliatory', label: 'Appears retaliatory' },
  { value: 'spam', label: 'Spam or irrelevant' },
  { value: 'other', label: 'Other' },
] as const;

type ReasonValue = (typeof REASONS)[number]['value'];

export function ReportReviewSheet({ reviewId }: { reviewId: string }) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetHeight = winH * 0.55;
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<ReasonValue | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const closeSheet = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setReason('');
      setSubmitted(false);
      setError('');
      setIsSubmitting(false);
    }, 200);
  }, []);

  const handleSubmit = async () => {
    if (!reason) return;
    setIsSubmitting(true);
    setError('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Not signed in');

      const { error: insertError } = await supabase.from('review_reports').insert({
        review_id: reviewId,
        reporter_id: user.id,
        reason,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sheetTopRadius = radius.xl + 4;

  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8} accessibilityRole="button">
        <Text style={styles.reportLink}>Report</Text>
      </Pressable>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeSheet} accessibilityLabel="Close" />
          <View
            style={[
              styles.sheetOuter,
              {
                height: sheetHeight,
                maxHeight: sheetHeight,
                borderTopLeftRadius: sheetTopRadius,
                borderTopRightRadius: sheetTopRadius,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.handle} />

            {submitted ? (
              <View style={styles.doneWrap}>
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
                <Text style={styles.sheetTitle}>Report submitted</Text>
                <Text style={styles.sheetBody}>
                  The LinkUp team will review this report within 48 hours.
                </Text>
                <Pressable style={styles.secondaryButton} onPress={closeSheet}>
                  <Text style={styles.secondaryButtonLabel}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.sheetTitle}>Report this review</Text>

                {REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    style={styles.reasonRow}
                    onPress={() => setReason(r.value)}
                  >
                    <View
                      style={[styles.radioOuter, reason === r.value && styles.radioOuterSelected]}
                    >
                      {reason === r.value ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.reasonLabel}>{r.label}</Text>
                  </Pressable>
                ))}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.sheetButtons}>
                  <Pressable style={styles.secondaryButton} onPress={closeSheet}>
                    <Text style={styles.secondaryButtonLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryOuter, (!reason || isSubmitting) && styles.primaryDisabled]}
                    onPress={() => void handleSubmit()}
                    disabled={!reason || isSubmitting}
                  >
                    <LinearGradient
                      colors={
                        !reason || isSubmitting
                          ? [colors.border, colors.border]
                          : [colors.primary, colors.secondary]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryGradient}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.primaryButtonLabel}>Submit report</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  reportLink: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetOuter: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.md },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  sheetBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.danger,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  primaryOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  primaryGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
