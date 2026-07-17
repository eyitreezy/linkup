import { Button } from '@/components/Button';
import { Input, planCreateTouchableFieldStyle } from '@/components/Input';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  buildRequirementsNotice,
  deriveInitialOfferRequirements,
  deriveInitialOfferSnapshot,
  validateCounterForm,
} from '@/lib/plans/initialOfferRequirements';
import { defaultCounterAmount } from '@/lib/plans/negotiationActions';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbPlanOffer, DbPlanOfferRound } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  KeyboardAwareScrollView as ControllerAwareScrollView,
  KeyboardAvoidingView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  offer: DbPlanOffer | null;
  currency: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (
    amountCents: number | null,
    note: string,
    proposedScheduledAt: string | null
  ) => void;
};

export function OfferCounterSheet({
  visible,
  offer,
  currency,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetTopRadius = radius.xl + 4;
  const sheetMaxHeight = Math.min(winH * 0.88, 640);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proposedAt, setProposedAt] = useState<Date | null>(null);
  const [showTime, setShowTime] = useState(false);
  const [rounds, setRounds] = useState<DbPlanOfferRound[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const loadRounds = useCallback(async () => {
    if (!offer?.id || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from('plan_offer_rounds')
      .select('*')
      .eq('offer_id', offer.id)
      .order('created_at', { ascending: true });
    if (data) setRounds(data as DbPlanOfferRound[]);
  }, [offer?.id]);

  useEffect(() => {
    if (visible && offer) void loadRounds();
  }, [visible, offer, loadRounds]);

  const requirements = useMemo(() => {
    if (!offer) {
      return { requireAmount: false, requireNote: false, requireDate: false };
    }
    const snapshot = deriveInitialOfferSnapshot(offer, rounds);
    return deriveInitialOfferRequirements(snapshot);
  }, [offer, rounds]);

  const requirementsNotice = useMemo(() => buildRequirementsNotice(requirements), [requirements]);

  useEffect(() => {
    if (visible && offer) {
      setAmount(defaultCounterAmount(offer));
      setNote(offer.message?.trim() ?? '');
      setProposedAt(offer.proposed_scheduled_at ? new Date(offer.proposed_scheduled_at) : null);
      setFormError(null);
      setShowTime(false);
    }
  }, [visible, offer]);

  function openMeetTimePicker() {
    const base = proposedAt ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (e, date) => {
          if (e.type === 'dismissed' || !date) return;
          const merged = new Date(date);
          merged.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
          setTimeout(() => {
            DateTimePickerAndroid.open({
              value: merged,
              mode: 'time',
              is24Hour: false,
              onChange: (ev, timeDate) => {
                if (ev.type === 'dismissed' || !timeDate) return;
                setProposedAt(timeDate);
              },
            });
          }, 0);
        },
      });
      return;
    }
    setShowTime(true);
  }

  function handleSubmit() {
    const trimmed = amount.trim();
    const cents = trimmed ? Math.round(Number(trimmed) * 100) : null;
    if (trimmed && (Number.isNaN(cents) || cents! < 0)) {
      setFormError('Enter a valid amount.');
      return;
    }
    const proposedScheduledAt = proposedAt ? proposedAt.toISOString() : null;
    const validationError = validateCounterForm(requirements, {
      amountCents: cents,
      note: note.trim(),
      proposedScheduledAt,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    onSubmit(cents, note.trim(), proposedScheduledAt);
  }

  const amountLabel = requirements.requireAmount
    ? `Your counter amount (${currency}) *`
    : `Your counter amount (${currency})`;
  const dateLabel = requirements.requireDate ? 'Proposed date & time *' : 'Proposed date & time';
  const noteLabel = requirements.requireNote ? 'Note *' : 'Note';

  if (!visible || !offer) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close counter sheet" />
        <View
          style={[
            styles.sheetOuter,
            {
              maxHeight: sheetMaxHeight,
              borderTopLeftRadius: sheetTopRadius,
              borderTopRightRadius: sheetTopRadius,
            },
          ]}
        >
          <View
            style={[
              styles.sheetSurface,
              {
                borderTopLeftRadius: sheetTopRadius,
                borderTopRightRadius: sheetTopRadius,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.handle} />
              <View style={styles.headerRow}>
                <Text style={styles.title}>Send a counter offer</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <ControllerAwareScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bottomOffset={24}
              extraKeyboardSpace={20}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{requirementsNotice}</Text>
              </View>

              <Input
                label={amountLabel}
                variant="onboardingFlat"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder={requirements.requireAmount ? 'Required' : 'e.g. 5000'}
              />

              <Text style={styles.fieldLabel}>{dateLabel}</Text>
              <Pressable onPress={openMeetTimePicker} style={planCreateTouchableFieldStyle(styles.timeBtnRow)}>
                <View style={styles.timeRowLeft}>
                  <LinearGradient
                    colors={['rgba(94, 82, 255, 0.18)', 'rgba(255, 74, 114, 0.14)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.timeIconBubble}
                  >
                    <Ionicons name="calendar" size={18} color={colors.primary} />
                  </LinearGradient>
                  <Text style={styles.timeBtnTxt}>
                    {proposedAt
                      ? proposedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                      : 'Pick a date & time'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              {Platform.OS === 'ios' && showTime ? (
                <View style={styles.iosPickerWrap}>
                  <DateTimePicker
                    value={proposedAt ?? new Date()}
                    mode="datetime"
                    display="spinner"
                    onChange={(_, d) => {
                      if (d) setProposedAt(d);
                    }}
                  />
                  <Button title="Done" variant="ghost" onPress={() => setShowTime(false)} />
                </View>
              ) : null}

              <Input
                label={noteLabel}
                variant="onboardingFlat"
                value={note}
                onChangeText={setNote}
                placeholder={
                  requirements.requireNote
                    ? 'Required — add context for your counter'
                    : 'Add a message with your counter…'
                }
                multiline
              />

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={onClose}
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={handleSubmit}
                  style={({ pressed }) => [styles.submitOuter, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={[...APP_CTA_GRADIENT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitBtn}
                  >
                    <Text style={styles.submitLabel}>{loading ? 'Sending…' : 'Send counter'}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ControllerAwareScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheetOuter: {
    width: '100%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  sheetSurface: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.45)',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  notice: {
    backgroundColor: 'rgba(237, 232, 255, 0.4)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.15)',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  timeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 54,
  },
  timeRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  timeIconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBtnTxt: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    flex: 1,
    letterSpacing: -0.2,
    minWidth: 0,
  },
  iosPickerWrap: { marginBottom: spacing.sm },
  formError: {
    fontSize: 13,
    color: colors.danger,
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  submitOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  submitBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  submitLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.92 },
});
