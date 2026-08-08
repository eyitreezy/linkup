/**
 * Create plan — Step 1: meet type, schedule, duration, mood (premium carousel + progress).
 */
import { FlexibleHourSelector } from '@/components/plans/create/FlexibleHourSelector';
import { CreatePlanHeroCarousel } from '@/components/plans/create/CreatePlanHeroCarousel';
import { CreatePlanStickyProgress } from '@/components/plans/create/CreatePlanProgressBar';
import { CreatePlanWizardBack } from '@/components/plans/create/CreatePlanWizardBack';
import { CreatePlanWizardFooter } from '@/components/plans/create/CreatePlanWizardFooter';
import { MeetTypeSelectorSection } from '@/components/plans/create/MeetTypeSelectorSection';
import { authSoftLabelStyle, planCreateTouchableFieldStyle } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { useAuth } from '@/contexts/AuthContext';
import { computeMoodExpiresAt } from '@/lib/plans/moodPlanComputations';
import { applyMoodPlanLiveNow } from '@/lib/plans/moodPlanStart';
import { requiresVerificationGate } from '@/lib/verification/access';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardSafeScrollView } from '@/components/layout/KeyboardSafeScrollView';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { MEETUP_DURATION_QUICK_PRESETS } from '@/lib/plans/moodPlanUiHelpers';

function clampScheduledNotPast(d: Date): Date {
  const now = new Date();
  if (d.getTime() >= now.getTime()) return d;
  const bumped = new Date(now);
  bumped.setMinutes(bumped.getMinutes() + 1, 0, 0);
  return bumped;
}

export default function CreatePlanStepMeetScreen() {
  const { draft, setDraft } = usePlanDraft();
  const { dbUser, isAdmin, profile } = useAuth();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [androidPick, setAndroidPick] = useState<'idle' | 'date' | 'time'>('idle');
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (!draft.isMoodPlan || !draft.scheduledAt) return;
    const exp = computeMoodExpiresAt({
      scheduledAt: draft.scheduledAt,
      listingHours: draft.moodListingHours,
      window: draft.moodWindow,
      customStart: draft.moodCustomStart,
      customEnd: draft.moodCustomEnd,
    });
    setDraft((d) => (d.moodExpiresAt?.getTime() === exp.getTime() ? d : { ...d, moodExpiresAt: exp }));
  }, [
    draft.isMoodPlan,
    draft.scheduledAt,
    draft.moodListingHours,
    draft.moodWindow,
    draft.moodCustomStart,
    draft.moodCustomEnd,
    setDraft,
  ]);

  function goNext() {
    if (!draft.meetTypeId || !draft.scheduledAt) return;
    if (draft.isMoodPlan) {
      if (!draft.moodType?.trim()) return;
      const live = applyMoodPlanLiveNow(draft);
      if (!live.moodExpiresAt) return;
      if (live.moodWindow === 'custom') {
        if (!live.moodCustomStart || !live.moodCustomEnd) return;
        if (live.moodCustomEnd.getTime() <= live.moodCustomStart.getTime()) return;
      }
      setDraft(live);
      requestAnimationFrame(() => router.push('/plan/create/commitment'));
      return;
    }
    router.push('/plan/create/commitment');
  }

  function onContinue() {
    if (
      requiresVerificationGate(dbUser?.verification_status, {
        isAdmin,
        verifiedBadge: profile?.verified_badge,
      })
    ) {
      setGateOpen(true);
      return;
    }
    goNext();
  }

  const stepValid =
    !!draft.meetTypeId &&
    !!draft.scheduledAt &&
    (!draft.isMoodPlan ||
      (!!draft.moodType?.trim() &&
        !!draft.moodExpiresAt &&
        (draft.moodWindow !== 'custom' ||
          (!!draft.moodCustomStart &&
            !!draft.moodCustomEnd &&
            draft.moodCustomEnd.getTime() > draft.moodCustomStart.getTime()))));

  return (
    <Screen scroll={false} safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenBg}>
        <View style={styles.flex}>
          <AppShellBackground />
          <VerificationHardGateModal
            visible={gateOpen}
            onClose={() => setGateOpen(false)}
            verificationStatus={dbUser?.verification_status}
          />
          <CreatePlanStickyProgress current={0} />
          <CreatePlanWizardBack />
          <KeyboardSafeScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            style={styles.flex}
            footer={<CreatePlanWizardFooter onPress={onContinue} disabled={!stepValid} />}
          >
          <CreatePlanHeroCarousel />

          <View style={styles.titleBlock}>
            <View style={styles.titleAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>When & how you’ll meet</Text>
              <Text style={styles.sub}>Choose your meet type, timing and duration. Mood plans add extra spark in Discover.</Text>
            </View>
          </View>

          <MeetTypeSelectorSection />

          <Text style={styles.section}>Meetup duration</Text>
          <Text style={styles.durationHint}>
            How long the hangout itself is expected to last. This is separate from mood listing time in Discover.
          </Text>
          {draft.durationMinutes == null ? (
            <View style={styles.flexibleBlock}>
              <Text style={styles.flexibleLabel}>Flexible length</Text>
              <Text style={styles.flexibleSub}>Guests can agree on timing in chat.</Text>
              <Pressable
                onPress={() => setDraft((prev) => ({ ...prev, durationMinutes: 60 }))}
                style={({ pressed }) => [styles.setDurationBtn, pressed && styles.datePressed]}
              >
                <Text style={styles.setDurationBtnTxt}>Set a duration instead</Text>
              </Pressable>
            </View>
          ) : (
            <FlexibleHourSelector
              label="Duration"
              value={draft.durationMinutes}
              min={15}
              max={360}
              step={15}
              unit="minutes"
              presets={MEETUP_DURATION_QUICK_PRESETS}
              onChange={(m) => setDraft((prev) => ({ ...prev, durationMinutes: m }))}
            />
          )}
          <Pressable
            onPress={() =>
              setDraft((prev) => ({
                ...prev,
                durationMinutes: prev.durationMinutes == null ? 60 : null,
              }))
            }
            style={styles.flexibleToggleWrap}
          >
            {draft.durationMinutes == null ? (
              <LinearGradient colors={[...APP_CHIP_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flexibleToggleGrad}>
                <Text style={styles.durTxtOn}>Flexible duration</Text>
              </LinearGradient>
            ) : (
              <View style={styles.flexibleTogglePlain}>
                <Text style={styles.durTxt}>Use flexible duration</Text>
              </View>
            )}
          </Pressable>

          {draft.isMoodPlan ? (
            <>
              <Text style={authSoftLabelStyle}>Goes live</Text>
              <View style={[...planCreateTouchableFieldStyle({ marginBottom: spacing.md }), styles.moodLiveField]}>
                <Text style={styles.moodLiveTxt}>Right now</Text>
                <Text style={styles.moodLiveSub}>
                  Mood plans start when you publish. Listing duration controls how long you stay in Discover.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={authSoftLabelStyle}>Meet time</Text>
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'android') setAndroidPick('date');
                  else setIosPickerOpen(true);
                }}
                style={({ pressed }) => [
                  ...planCreateTouchableFieldStyle({ marginBottom: spacing.md }),
                  styles.dateField,
                  pressed && styles.datePressed,
                ]}
              >
                <Text style={styles.dateTxt}>
                  {draft.scheduledAt
                    ? draft.scheduledAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Pick a time'}
                </Text>
              </Pressable>
              {Platform.OS === 'ios' && iosPickerOpen ? (
                <DateTimePicker
                  value={draft.scheduledAt ?? new Date()}
                  mode="datetime"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(_ev, date) => {
                    if (date) setDraft((d) => ({ ...d, scheduledAt: clampScheduledNotPast(date) }));
                  }}
                />
              ) : null}
              {Platform.OS === 'android' && androidPick === 'date' ? (
                <DateTimePicker
                  value={draft.scheduledAt ?? new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(ev, date) => {
                    setAndroidPick('idle');
                    if (ev.type === 'dismissed' || !date) return;
                    setDraft((d) => {
                      const base = d.scheduledAt ?? new Date();
                      const next = new Date(date);
                      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
                      return { ...d, scheduledAt: clampScheduledNotPast(next) };
                    });
                    requestAnimationFrame(() => setAndroidPick('time'));
                  }}
                />
              ) : null}
              {Platform.OS === 'android' && androidPick === 'time' ? (
                <DateTimePicker
                  value={draft.scheduledAt ?? new Date()}
                  mode="time"
                  display="default"
                  onChange={(ev, date) => {
                    setAndroidPick('idle');
                    if (ev.type === 'dismissed' || !date) return;
                    setDraft((d) => {
                      const base = d.scheduledAt ?? new Date();
                      const next = new Date(base);
                      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                      return { ...d, scheduledAt: clampScheduledNotPast(next) };
                    });
                  }}
                />
              ) : null}
            </>
          )}

          </KeyboardSafeScrollView>
        </View>
      </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenBg: { backgroundColor: 'transparent' },
  scroll: { paddingBottom: 120, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  titleBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  titleAccent: {
    width: 5,
    marginTop: 6,
    borderRadius: 3,
    height: 52,
    backgroundColor: colors.secondary,
  },
  title: { fontSize: 26, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 16, color: colors.textMuted, lineHeight: 23, fontWeight: '600', fontFamily: fonts.medium, },
  section: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 8,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  durationHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '600',
    fontFamily: fonts.medium,
    marginBottom: spacing.sm,
  },
  flexibleBlock: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    gap: 6,
  },
  flexibleLabel: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: fonts.bold },
  flexibleSub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, fontFamily: fonts.medium },
  setDurationBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.25)',
  },
  setDurationBtnTxt: { fontSize: 13, fontWeight: '800', color: colors.primary, fontFamily: fonts.bold },
  flexibleToggleWrap: { marginBottom: spacing.md, borderRadius: radius.button, overflow: 'hidden', alignSelf: 'flex-start' },
  flexibleToggleGrad: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.button },
  flexibleTogglePlain: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255, 0.22)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  durTxt: { fontSize: 14, fontWeight: '800', fontFamily: fonts.bold, color: colors.text },
  durTxtOn: { fontSize: 14, fontWeight: '900', color: '#fff', fontFamily: fonts.bold },
  dateField: {
    borderColor: 'rgba(255, 74, 114, 0.35)',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  datePressed: { opacity: 0.96 },
  dateTxt: { fontSize: 16, fontWeight: '700',
    fontFamily: fonts.medium, color: colors.text },
  moodLiveField: {
    borderColor: 'rgba(255, 120, 80, 0.35)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: spacing.md,
    gap: 6,
  },
  moodLiveTxt: { fontSize: 16, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  moodLiveSub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18, fontFamily: fonts.medium, },
});
