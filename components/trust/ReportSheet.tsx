/**
 * Trust report flow — bottom sheet styled like Notification Inbox (gradient shell, inbox rows, dual CTAs).
 */
import { Input } from '@/components/Input';
import { colors, radius, spacing } from '@/constants/theme';
import type { ReportReasonCode } from '@/lib/trust/submitReport';
import { submitUserReport } from '@/lib/trust/submitReport';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REASONS: { code: ReportReasonCode; label: string; sub: string }[] = [
  { code: 'scam', label: 'Scam or fraud', sub: 'Money, off-app payments, or phishing vibes.' },
  { code: 'fake_profile', label: 'Fake profile', sub: 'They don’t match who they say they are.' },
  { code: 'harassment', label: 'Harassment', sub: 'Unwanted pressure, threats, or stalking.' },
  { code: 'inappropriate', label: 'Inappropriate content', sub: 'Sexual, violent, or hateful material.' },
  { code: 'other', label: 'Something else', sub: 'We’ll review with context.' },
];

type Step = 'reason' | 'note' | 'done';

type Props = {
  visible: boolean;
  onClose: () => void;
  reporterId: string;
  reportedUserId: string;
  contentType: 'message' | 'plan' | 'profile' | 'user';
  contentId: string | null;
  title?: string;
};

export function ReportSheet({
  visible,
  onClose,
  reporterId,
  reportedUserId,
  contentType,
  contentId,
  title = 'Report',
}: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('reason');
    setReason(null);
    setNote('');
    setErr(null);
    setBusy(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const openPlanDispute = useCallback(() => {
    if (!contentId) return;
    handleClose();
    router.push(`/dispute/${contentId}` as Href);
  }, [contentId, handleClose]);

  const submit = useCallback(async () => {
    if (!reason) return;
    setBusy(true);
    setErr(null);
    const { error } = await submitUserReport({
      reporterId,
      reportedUserId,
      contentType,
      contentId,
      reason,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setStep('done');
  }, [reporterId, reportedUserId, contentType, contentId, reason, note]);

  const sheetBottomPad = Math.max(insets.bottom, spacing.md);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close" />
      <View style={[styles.sheetOuter, { paddingBottom: sheetBottomPad }]}>
        <LinearGradient
          colors={['#EDE8FF', '#FFFFFF', '#FFF5F8', colors.surface]}
          locations={[0, 0.25, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.handle} />
        <View style={styles.headerBlock}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leadAccent}
          />
          <View style={styles.headerTextCol}>
            <Text style={styles.leadKicker}>Trust & safety</Text>
            <Text style={styles.sheetTitle}>{title}</Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closePill, pressed && styles.pressed]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.trustCopy}>
          Reports are confidential. We never share details with the other person. You’re helping keep LinkUp safer
          for everyone.
        </Text>

        {step === 'reason' ? (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {contentType === 'plan' && contentId ? (
              <Pressable
                onPress={openPlanDispute}
                style={({ pressed }) => [styles.disputeEntry, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Open plan dispute and meeting safety"
              >
                <LinearGradient
                  colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.disputeEntryBorder}
                >
                  <View style={styles.disputeEntryInner}>
                    <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.disputeIconGrad}>
                      <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.disputeEntryText}>
                      <Text style={styles.disputeEntryTitle}>Plan dispute & meeting safety</Text>
                      <Text style={styles.disputeEntrySub}>
                        After a match — structured timeline, evidence, and team review (separate from a profile report).
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                </LinearGradient>
              </Pressable>
            ) : null}

            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>What’s going on?</Text>
              </View>
              <LinearGradient
                colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionRule}
              />
            </View>

            {REASONS.map((r) => {
              const on = reason === r.code;
              return (
                <Pressable
                  key={r.code}
                  onPress={() => setReason(r.code)}
                  style={({ pressed }) => [
                    styles.reasonRowOuter,
                    pressed && { opacity: 0.92 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  {on ? (
                    <LinearGradient
                      colors={[colors.primary, '#8B7CE8', colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.reasonRowGradBorder}
                    >
                      <View style={styles.reasonRowInnerActive}>
                        <View style={styles.reasonIconWrapSelected}>
                          <Ionicons name="checkmark" size={22} color={colors.primary} />
                        </View>
                        <View style={styles.reasonTextCol}>
                          <Text style={styles.reasonTitle}>{r.label}</Text>
                          <Text style={styles.reasonSub}>{r.sub}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.reasonRow}>
                      <View style={styles.reasonIconWrap}>
                        <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                      </View>
                      <View style={styles.reasonTextCol}>
                        <Text style={styles.reasonTitle}>{r.label}</Text>
                        <Text style={styles.reasonSub}>{r.sub}</Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setStep('note')}
              disabled={!reason}
              style={({ pressed }) => [
                styles.ctaFullOuter,
                !reason && styles.ctaDisabled,
                pressed && reason && { opacity: 0.94, transform: [{ scale: 0.985 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <LinearGradient
                colors={!reason ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaFullGrad}
              >
                <Text style={[styles.ctaFullTxt, !reason && styles.ctaFullTxtDim]}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={!reason ? 'rgba(255,255,255,0.65)' : '#FFFFFF'} />
              </LinearGradient>
            </Pressable>
          </ScrollView>
        ) : null}

        {step === 'note' ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContentPad}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>Optional details</Text>
              </View>
              <LinearGradient
                colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionRule}
              />
            </View>
            <Text style={styles.noteHint}>Anything else we should know?</Text>
            <Input
              variant="onboardingFlat"
              multiline
              numberOfLines={4}
              value={note}
              onChangeText={setNote}
              placeholder="Context helps — no need to repeat chat verbatim."
            />
            {err ? <Text style={styles.err}>{err}</Text> : null}

            <View style={styles.dualCtaRow}>
              <Pressable
                onPress={() => setStep('reason')}
                disabled={busy}
                style={({ pressed }) => [styles.dualCtaFlex, pressed && !busy && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.outlineRing}
                >
                  <View style={styles.outlineInner}>
                    <Ionicons name="arrow-back" size={18} color={colors.primary} />
                    <Text style={styles.outlineTxt}>Back</Text>
                  </View>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => void submit()}
                disabled={busy}
                style={({ pressed }) => [styles.dualCtaFlex, pressed && !busy && { opacity: 0.94, transform: [{ scale: 0.985 }] }]}
                accessibilityRole="button"
                accessibilityLabel="Submit report"
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGrad}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.submitTxt}>Submit</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}

        {step === 'done' ? (
          <View style={styles.doneWrap}>
            <LinearGradient
              colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.doneIconRing}
            >
              <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.doneIconGrad}>
                <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
              </LinearGradient>
            </LinearGradient>
            <Text style={styles.doneTitle}>Thanks — we’ve got it</Text>
            <Text style={styles.doneBody}>
              Our team reviews reports carefully. We’ll take action if someone broke the rules. You won’t hear back
              for every report, but it really does help.
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.ctaFullOuter, pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaFullGrad}
              >
                <Text style={styles.ctaFullTxt}>Close</Text>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 29, 38, 0.45)' },
  sheetOuter: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 29, 38, 0.12)',
    marginBottom: spacing.md,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  leadAccent: {
    width: 5,
    marginTop: 6,
    borderRadius: 3,
    height: 48,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  closePill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  pressed: { opacity: 0.92 },
  trustCopy: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  scroll: { maxHeight: 440 },
  scrollContentPad: { paddingBottom: spacing.md },
  sectionHead: { marginBottom: spacing.sm },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: { height: 2, borderRadius: 1, opacity: 0.9 },
  disputeEntry: { marginBottom: spacing.md },
  disputeEntryBorder: { borderRadius: radius.xl, padding: 2 },
  disputeEntryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  disputeIconGrad: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeEntryText: { flex: 1, minWidth: 0 },
  disputeEntryTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  disputeEntrySub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4, lineHeight: 19 },
  reasonRowOuter: {
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  reasonRowGradBorder: {
    padding: 2,
    borderRadius: radius.lg,
  },
  reasonRowInnerActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg - 4,
    backgroundColor: colors.surface,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  reasonIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  reasonIconWrapSelected: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  reasonTextCol: { flex: 1, minWidth: 0 },
  reasonTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  reasonSub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4, lineHeight: 19 },
  noteHint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  err: { color: colors.danger, marginTop: spacing.sm, fontWeight: '600' },
  ctaFullOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginTop: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  ctaDisabled: { opacity: 0.55 },
  ctaFullGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  ctaFullTxt: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  ctaFullTxtDim: { color: 'rgba(255,255,255,0.75)' },
  dualCtaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dualCtaFlex: { flex: 1, minWidth: 0, borderRadius: radius.button, overflow: 'hidden', alignSelf: 'stretch' },
  outlineRing: {
    padding: 2,
    borderRadius: radius.button,
    flex: 1,
    width: '100%',
    minHeight: 56,
    alignSelf: 'stretch',
  },
  outlineInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
  },
  outlineTxt: { fontSize: 15, fontWeight: '800', color: colors.primary },
  submitGrad: {
    flex: 1,
    width: '100%',
    minHeight: 56,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  submitTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  doneWrap: { paddingVertical: spacing.lg, alignItems: 'center' },
  doneIconRing: {
    borderRadius: 40,
    padding: 3,
    marginBottom: spacing.md,
  },
  doneIconGrad: {
    width: 72,
    height: 72,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  doneBody: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
});