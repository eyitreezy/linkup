/**
 * Modal editor for plan management — fields respect `getCreatorEditCapabilities`.
 * Visual language aligned with the create-plan wizard (gradients, Inputs, cards).
 */
import { Button } from '@/components/Button';
import { Input, authSoftLabelStyle, planCreateTouchableFieldStyle } from '@/components/Input';
import { EscrowTrustExplainerCard } from '@/components/plans/create/EscrowTrustExplainerCard';
import { PlanLocationSection } from '@/components/plans/create/PlanLocationSection';
import { VisibilityPickCard } from '@/components/plans/create/VisibilityPickCard';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing } from '@/constants/theme';
import {
  buildCreatorPlanPatch,
  getCreatorEditCapabilities,
  type BuildPatchInput,
} from '@/lib/plans/planCreatorEditPolicy';
import { persistModerationAfterSend } from '@/lib/trust/persistModeration';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan, EscrowPattern } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function clampScheduledNotPast(d: Date): Date {
  const now = new Date();
  return d.getTime() < now.getTime() ? now : d;
}

const DURATIONS = [
  { m: 30, label: '30m' },
  { m: 60, label: '1h' },
  { m: 90, label: '1.5h' },
  { m: 120, label: '2h' },
  { m: 180, label: '3h+' },
] as const;

const VISIBILITY_OPTIONS: {
  value: DbPlan['visibility'];
  title: string;
  description: string;
  icon: 'globe-outline' | 'navigate-outline' | 'people-outline';
}[] = [
  {
    value: 'public',
    title: 'Public',
    description: 'Anyone on LinkUp can discover this plan in the feed.',
    icon: 'globe-outline',
  },
  {
    value: 'radius',
    title: 'Within radius',
    description: 'Shown to people roughly within your discovery radius.',
    icon: 'navigate-outline',
  },
  {
    value: 'friends',
    title: 'Friends only',
    description: 'Only your connections see this (once friends ship, this tightens automatically).',
    icon: 'people-outline',
  },
];

const ESCROW_PATTERNS: { id: EscrowPattern; label: string; sub: string }[] = [
  { id: 'A', label: 'Host funds', sub: 'You back the invite' },
  { id: 'B', label: 'Split', sub: 'Both contribute' },
  { id: 'C', label: 'Guest funds', sub: 'Tier 2 KYC' },
];

function priceHint(ngn: number): string {
  if (!Number.isFinite(ngn) || ngn <= 0) {
    return 'Add an amount — we’ll size hints from your number.';
  }
  if (ngn < 8000) return 'Coffee & chill plans often land ₦5k–₦12k.';
  if (ngn < 25000) return 'Dinner meetups usually range ₦8k–₦25k.';
  return 'Premium social plans often start ₦10k+ — make sure the story matches the ask.';
}

function EscrowPatternChip({
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
    <Pressable
      onPress={onPress}
      style={[styles.escrowPatternChip, selected && styles.escrowPatternChipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.escrowPatternLabel, selected && styles.escrowPatternLabelOn]}>{label}</Text>
      <Text style={[styles.escrowPatternSub, selected && styles.escrowPatternSubOn]}>{sub}</Text>
    </Pressable>
  );
}

type Props = {
  visible: boolean;
  plan: DbPlan | null;
  offersCount: number;
  onClose: () => void;
  onSaved: () => void;
};

export function PlanCreatorEditSheet({ visible, plan, offersCount, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const caps = useMemo(
    () => (plan ? getCreatorEditCapabilities(plan, offersCount) : null),
    [plan, offersCount]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState<DbPlan['visibility']>('public');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [moodType, setMoodType] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [startingPriceNgn, setStartingPriceNgn] = useState('');
  const [escrowPattern, setEscrowPattern] = useState<EscrowPattern | null>(null);
  const [hostBps, setHostBps] = useState('5000');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [androidPick, setAndroidPick] = useState<'idle' | 'date' | 'time'>('idle');

  useEffect(() => {
    if (!visible || !plan) return;
    setTitle(plan.title ?? '');
    setDescription(plan.description ?? '');
    setCategory(plan.category ?? '');
    setVisibility(plan.visibility ?? 'public');
    setScheduledAt(plan.scheduled_at ? new Date(plan.scheduled_at) : new Date());
    setLocationLabel(plan.location_label ?? '');
    setLatitude(plan.latitude ?? null);
    setLongitude(plan.longitude ?? null);
    setDurationMinutes(plan.duration_minutes != null ? String(plan.duration_minutes) : '');
    setMoodType(plan.mood_type ?? '');
    setIsPaid(!!plan.is_paid);
    setStartingPriceNgn(
      plan.starting_price_cents != null ? String(plan.starting_price_cents / 100) : ''
    );
    setEscrowPattern(plan.escrow_pattern ?? null);
    setHostBps(plan.host_contribution_bps != null ? String(plan.host_contribution_bps) : '5000');
    setIosPickerOpen(false);
    setAndroidPick('idle');
  }, [visible, plan?.id]);

  const form = useMemo(
    (): BuildPatchInput => ({
      title,
      description,
      category,
      visibility,
      scheduledAt,
      locationLabel,
      latitude,
      longitude,
      durationMinutes,
      moodType,
      isPaid,
      startingPriceNgn,
      escrowPattern,
      hostContributionBps: escrowPattern === 'B' ? parseInt(hostBps, 10) || 5000 : null,
    }),
    [
      title,
      description,
      category,
      visibility,
      scheduledAt,
      locationLabel,
      latitude,
      longitude,
      durationMinutes,
      moodType,
      isPaid,
      startingPriceNgn,
      escrowPattern,
      hostBps,
    ]
  );

  const save = useCallback(async () => {
    if (!plan || !caps || !isSupabaseConfigured) return;
    const { patch, error } = buildCreatorPlanPatch(plan, offersCount, form);
    if (error) {
      setFeedback({ variant: 'warning', title: 'Check fields', message: error });
      return;
    }
    if (Object.keys(patch).length === 0) {
      setFeedback({ variant: 'warning', title: 'Nothing to save', message: 'Update at least one field.' });
      return;
    }
    setSaving(true);
    const { error: upErr } = await supabase.from('plans').update(patch).eq('id', plan.id);
    setSaving(false);
    if (upErr) {
      setFeedback({ variant: 'error', title: 'Could not save', message: upErr.message });
      return;
    }
    const sample =
      `${String(patch.title ?? plan.title)}\n${String(patch.description ?? plan.description ?? '')}`.trim();
    void persistModerationAfterSend({
      contentType: 'plan',
      contentId: plan.id,
      textSample: sample || plan.title,
    });
    onSaved();
    onClose();
  }, [plan, caps, offersCount, form, onClose, onSaved]);

  if (!plan) return null;

  const hintPostAccept =
    plan.accepted_offer_id != null
      ? 'Agreement details stay tied to the accepted offer — you can only refresh how this plan reads in the app.'
      : null;

  const ngn = startingPriceNgn.trim() ? Number(startingPriceNgn) : NaN;
  const durationParsed = parseInt(durationMinutes.trim(), 10);
  const durationChipActive = (m: number) =>
    Number.isFinite(durationParsed) && durationParsed === m && durationMinutes.trim() !== '';
  const durationFlexible = !durationMinutes.trim();

  return (
    <>
      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'error'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
      />
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + 8 }]}>
          <LinearGradient
            colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.surface]}
            locations={[0, 0.2, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGradient}
            pointerEvents="none"
          />
          <View style={styles.sheetContent}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.sheetKicker}>Plan management</Text>
                <Text style={styles.sheetTitle}>Edit your listing</Text>
                <Text style={styles.sheetSub}>
                  Same polish as create — update what guests see before you save.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            {hintPostAccept ? (
              <LinearGradient
                colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hintBannerOuter}
              >
                <View style={styles.hintBannerInner}>
                  <Ionicons name="information-circle" size={22} color={colors.primary} />
                  <Text style={styles.hintBannerTxt}>{hintPostAccept}</Text>
                </View>
              </LinearGradient>
            ) : null}
            {caps?.lockReason && !caps.canEdit ? (
              <View style={styles.lockedCard}>
                <Ionicons name="lock-closed" size={22} color={colors.textMuted} />
                <Text style={styles.lockedTxt}>{caps.lockReason}</Text>
              </View>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
              >
                {caps?.titleDescriptionCategory ? (
                  <View style={styles.leadBlock}>
                    <View style={styles.leadAccent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lead}>Refine the story</Text>
                      <Text style={styles.leadSub}>
                        Title and details stay in sync with how plans look in Discover.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {caps?.titleDescriptionCategory ? (
                  <>
                    <LinearGradient
                      colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.1)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.examplesOuter}
                    >
                      <View style={styles.examplesInner}>
                        <Text style={styles.exLabel}>Quick ideas · tap to use</Text>
                        {['Dinner in Lekki tonight', 'Gym partner this weekend', 'Coffee walk after work'].map(
                          (ex) => (
                            <Pressable
                              key={ex}
                              onPress={() => setTitle(ex)}
                              style={styles.exChip}
                            >
                              <Ionicons name="sparkles" size={16} color={colors.primary} />
                              <Text style={styles.exChipTxt}>{ex}</Text>
                            </Pressable>
                          )
                        )}
                      </View>
                    </LinearGradient>
                    <Input
                      label="Title"
                      variant="onboardingFlat"
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Dinner in Lekki tonight"
                    />
                    <Input
                      label="Description (optional)"
                      variant="onboardingFlat"
                      multiline
                      numberOfLines={4}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Intent, vibe, or what you’re offering"
                    />
                    <Input
                      label="Category (optional)"
                      variant="onboardingFlat"
                      value={category}
                      onChangeText={setCategory}
                      placeholder="e.g. food, fitness"
                    />
                  </>
                ) : null}

                {caps?.visibility ? (
                  <>
                    <View style={styles.sectionHead}>
                      <Ionicons name="eye-outline" size={20} color={colors.primary} />
                      <Text style={styles.sectionTitle}>Visibility</Text>
                    </View>
                    <View style={styles.visList}>
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <VisibilityPickCard
                          key={opt.value}
                          title={opt.title}
                          description={opt.description}
                          icon={opt.icon}
                          selected={visibility === opt.value}
                          onPress={() => setVisibility(opt.value)}
                        />
                      ))}
                    </View>
                  </>
                ) : null}

                {caps?.scheduleLocationDuration ? (
                  <>
                    <Text style={styles.sectionKicker}>When & where</Text>
                    <Text style={authSoftLabelStyle}>Meet time</Text>
                    <Pressable
                      style={({ pressed }) => [
                        ...planCreateTouchableFieldStyle({ marginBottom: spacing.md }),
                        styles.dateField,
                        pressed && styles.datePressed,
                      ]}
                      onPress={() => {
                        if (Platform.OS === 'android') setAndroidPick('date');
                        else setIosPickerOpen((v) => !v);
                      }}
                    >
                      <Text style={styles.dateTxt}>
                        {scheduledAt
                          ? scheduledAt.toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Pick date & time'}
                      </Text>
                    </Pressable>
                    {Platform.OS === 'ios' && iosPickerOpen && scheduledAt ? (
                      <DateTimePicker
                        value={scheduledAt}
                        mode="datetime"
                        display="spinner"
                        onChange={(_e, d) => {
                          if (d) setScheduledAt(clampScheduledNotPast(d));
                        }}
                      />
                    ) : null}
                    {Platform.OS === 'android' && androidPick === 'date' && scheduledAt ? (
                      <DateTimePicker
                        value={scheduledAt}
                        mode="date"
                        display="default"
                        onChange={(ev, date) => {
                          setAndroidPick('idle');
                          if (ev.type === 'dismissed' || !date) return;
                          const base = scheduledAt;
                          const next = new Date(date);
                          next.setHours(base.getHours(), base.getMinutes(), 0, 0);
                          setScheduledAt(clampScheduledNotPast(next));
                          requestAnimationFrame(() => setAndroidPick('time'));
                        }}
                      />
                    ) : null}
                    {Platform.OS === 'android' && androidPick === 'time' && scheduledAt ? (
                      <DateTimePicker
                        value={scheduledAt}
                        mode="time"
                        display="default"
                        onChange={(ev, date) => {
                          setAndroidPick('idle');
                          if (ev.type === 'dismissed' || !date) return;
                          const next = new Date(scheduledAt);
                          next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                          setScheduledAt(clampScheduledNotPast(next));
                        }}
                      />
                    ) : null}

                    <PlanLocationSection
                      locationLabel={locationLabel}
                      onApply={({ locationLabel: label, latitude: lat, longitude: lng }) => {
                        setLocationLabel(label);
                        setLatitude(lat);
                        setLongitude(lng);
                      }}
                    />

                    <Text style={styles.sectionSmall}>Duration</Text>
                    <View style={styles.durRow}>
                      {DURATIONS.map((d) => {
                        const on = durationChipActive(d.m);
                        return (
                          <Pressable
                            key={d.m}
                            onPress={() => setDurationMinutes(String(d.m))}
                            style={styles.durChipWrap}
                          >
                            {on ? (
                              <LinearGradient
                                colors={[colors.primary, '#8B7CE8', colors.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.durChipGrad}
                              >
                                <Text style={styles.durTxtOn}>{d.label}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.durChipPlain}>
                                <Text style={styles.durTxt}>{d.label}</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                      <Pressable onPress={() => setDurationMinutes('')} style={styles.durChipWrap}>
                        {durationFlexible ? (
                          <LinearGradient
                            colors={[colors.primary, '#8B7CE8', colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.durChipGrad}
                          >
                            <Text style={styles.durTxtOn}>Flexible</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.durChipPlain}>
                            <Text style={styles.durTxt}>Flexible</Text>
                          </View>
                        )}
                      </Pressable>
                    </View>
                    {!DURATIONS.some((d) => d.m === durationParsed) && durationMinutes.trim() !== '' ? (
                      <Input
                        label="Exact minutes (optional)"
                        variant="onboardingFlat"
                        value={durationMinutes}
                        onChangeText={setDurationMinutes}
                        placeholder="e.g. 45"
                        keyboardType="number-pad"
                      />
                    ) : null}
                  </>
                ) : null}

                {caps?.moodPresentation ? (
                  <LinearGradient
                    colors={['rgba(108,99,255,0.1)', 'rgba(255,101,132,0.06)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.moodCardOuter}
                  >
                    <View style={styles.moodCardInner}>
                      <Text style={styles.moodCardKicker}>Mood plan</Text>
                      <Input
                        label="Mood type"
                        variant="onboardingFlat"
                        value={moodType}
                        onChangeText={setMoodType}
                        placeholder="e.g. chill, spontaneous"
                        autoCapitalize="none"
                      />
                      <Text style={styles.moodNote}>
                        Listing deadline is fixed for trust. Urgency updates when you change the meet time.
                      </Text>
                    </View>
                  </LinearGradient>
                ) : null}

                {caps?.financial ? (
                  <View style={styles.escrowSection}>
                    <Text style={styles.escrowLead}>Commitment & plan security</Text>
                    <Text style={styles.escrowSublead}>
                      Same controls as create — secure commitment reduces flakes and builds trust.
                    </Text>
                    <EscrowTrustExplainerCard />
                    <View style={styles.paidRow}>
                      <View>
                        <Text style={styles.paidSectionLabel}>Paid plan</Text>
                        <Text style={styles.paidHint}>Free skips price and escrow for this meetup.</Text>
                      </View>
                      <Switch
                        value={isPaid}
                        onValueChange={setIsPaid}
                        trackColor={{ true: colors.primary, false: '#ccc' }}
                      />
                    </View>
                    {isPaid ? (
                      <>
                        <Text style={styles.paidSectionLabel}>Who funds commitment?</Text>
                        <View style={styles.patternRow}>
                          {ESCROW_PATTERNS.map((p) => (
                            <EscrowPatternChip
                              key={p.id}
                              label={p.label}
                              sub={p.sub}
                              selected={escrowPattern === p.id}
                              onPress={() => setEscrowPattern(p.id)}
                            />
                          ))}
                        </View>
                        {escrowPattern === 'B' ? (
                          <View style={styles.splitBlock}>
                            <Text style={styles.paidHint}>
                              Your share: {((parseInt(hostBps, 10) || 5000) / 100).toFixed(0)}%
                            </Text>
                            <Slider
                              style={styles.slider}
                              minimumValue={1000}
                              maximumValue={9000}
                              step={500}
                              value={parseInt(hostBps, 10) || 5000}
                              onValueChange={(v) => setHostBps(String(Math.round(v)))}
                              minimumTrackTintColor={colors.primary}
                              maximumTrackTintColor={colors.border}
                            />
                          </View>
                        ) : null}
                        <Input
                          label="Commitment amount (NGN)"
                          variant="onboardingFlat"
                          keyboardType="decimal-pad"
                          value={startingPriceNgn}
                          onChangeText={setStartingPriceNgn}
                          placeholder="e.g. 15000"
                        />
                        <View style={styles.hintCard}>
                          <Text style={styles.hintStrong}>Smart hint</Text>
                          <Text style={styles.hintCardTxt}>{priceHint(ngn)}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}

                <Button
                  title={saving ? 'Saving…' : 'Save changes'}
                  onPress={() => void save()}
                  disabled={saving || !caps?.canEdit}
                  style={styles.saveBtn}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    overflow: 'hidden',
    position: 'relative',
  },
  sheetGradient: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15,23,42,0.12)',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sheetSub: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
  },
  hintBannerOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.md,
  },
  hintBannerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  hintBannerTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockedTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 22,
  },
  scroll: { paddingBottom: spacing.xl * 2 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  leadAccent: {
    width: 5,
    marginTop: 6,
    borderRadius: 3,
    height: 48,
    backgroundColor: colors.primary,
  },
  lead: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  examplesOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
  },
  examplesInner: {
    padding: spacing.md,
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  exLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  exChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  exChipTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  visList: { marginTop: spacing.xs },
  sectionKicker: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 8,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSmall: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 8,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateField: {
    borderColor: 'rgba(255, 101, 132, 0.35)',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  datePressed: { opacity: 0.96 },
  dateTxt: { fontSize: 16, fontWeight: '700', color: colors.text },
  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  durChipWrap: { borderRadius: radius.button, overflow: 'hidden' },
  durChipGrad: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  durChipPlain: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  durTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  durTxtOn: { fontSize: 14, fontWeight: '900', color: '#fff' },
  moodCardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  moodCardInner: {
    padding: spacing.md,
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  moodCardKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  moodNote: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  escrowSection: { marginTop: spacing.md, marginBottom: spacing.sm },
  escrowLead: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  escrowSublead: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  paidSectionLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  paidHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  patternRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  escrowPatternChip: {
    flexGrow: 1,
    minWidth: '30%',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  escrowPatternChipOn: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  escrowPatternLabel: { fontWeight: '800', color: colors.text, fontSize: 13 },
  escrowPatternLabelOn: { color: colors.primary },
  escrowPatternSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  escrowPatternSubOn: { color: colors.text },
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
  hintStrong: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintCardTxt: { fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '600' },
  saveBtn: { marginTop: spacing.lg },
});
