/**
 * 5-step profile onboarding (Tinder × Hinge × Bumble hybrid).
 * Persists each step to Supabase; Moti for motion (RN-friendly Framer-like API).
 */
import { Button } from '@/components/Button';
import {
  authSoftLabelStyle,
  Input,
  onboardingTouchableFieldStyle,
} from '@/components/Input';
import { OnboardingStickyProgress } from '@/components/onboarding/OnboardingStickyProgress';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { Screen } from '@/components/Screen';
import { PhotoUploader } from '@/components/onboarding/PhotoUploader';
import { ProfileCardPreview } from '@/components/onboarding/ProfileCardPreview';
import { PromptSelector } from '@/components/onboarding/PromptSelector';
import { TagSelector } from '@/components/onboarding/TagSelector';
import { ProfileLocationSection } from '@/components/profile/ProfileLocationSection';
import { KeyboardAwareContainer } from '@/components/KeyboardAwareContainer';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthBootstrap } from '@/lib/auth/useAuthBootstrap';
import { postAuthHref, needsOnboarding } from '@/lib/auth/postAuthNavigation';
import {
  INTEREST_TAGS,
  LANGUAGE_OPTIONS,
  ONBOARDING_STEP_LABELS,
  ONBOARDING_STEP_SUBTITLES,
  ONBOARDING_TOTAL_STEPS,
  SAFETY_TIPS,
} from '@/lib/onboarding/constants';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { draftFromProfile, ageFromBirthDate, mergeDraftAfterSave } from '@/lib/onboarding/hydrate';
import {
  finalizeOnboarding,
  persistOnboardingResumeStep,
  saveOnboardingStep,
} from '@/lib/onboarding/persist';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { markSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { defaultOnboardingDraft } from '@/types/onboarding';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Redirect, router, type Href } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { user, session: activeSession, ready: authReady } = useAuthBootstrap();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const hydratedUserRef = useRef<string | null>(null);
  const skipDraftHydrateRef = useRef(false);

  /** Prefill draft once per signed-in user — not on every profile refresh (avoids wiping fields after Continue). */
  useLayoutEffect(() => {
    if (!profile?.user_id || skipDraftHydrateRef.current) return;
    if (hydratedUserRef.current === profile.user_id) return;
    hydratedUserRef.current = profile.user_id;
    setDraft(draftFromProfile(profile));
  }, [profile?.user_id]);

  /**
   * Restore wizard step only when the signed-in user changes — NOT on every profile refresh.
   * Otherwise `refreshProfile()` after "Continue" re-ran with stale `onboarding_step` and reset
   * the step index (e.g. bouncing back from step 2 to step 1).
   */
  useLayoutEffect(() => {
    if (!profile?.user_id) return;
    if (profile.onboarding_status === 'pending') {
      const raw = profile.preferences?.onboarding_step;
      const idx =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.max(0, Math.min(Math.floor(raw), ONBOARDING_TOTAL_STEPS - 1))
          : 0;
      setStep(idx);
    }
  }, [profile?.user_id, profile?.onboarding_status]);

  /** Persist resume index when the user moves between steps — not on every profile/preferences refresh (would race with `refreshProfile` after Continue). */
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured || !profile) return;
    if (profile.onboarding_status !== 'pending') return;

    void (async () => {
      const { error } = await persistOnboardingResumeStep({
        userId: user.id,
        stepIndex: step,
        existingPreferences: profile.preferences ?? null,
      });
      if (error && __DEV__) console.warn('[onboarding] resume step:', error.message);
    })();
  }, [step, user?.id, profile?.user_id, profile?.onboarding_status]);

  const prefs = profile?.preferences ?? null;

  const canContinue1 = useMemo(() => {
    const photos = draft.localPhotoUris.length + draft.remotePhotoUrls.length;
    const age = ageFromBirthDate(draft.birthDate);
    return (
      draft.displayName.trim().length >= 1 &&
      photos >= 1 &&
      draft.adultConfirmed &&
      age >= 18
    );
  }, [draft.displayName, draft.localPhotoUris.length, draft.remotePhotoUrls.length, draft.birthDate, draft.adultConfirmed]);

  const canContinue2 = useMemo(() => {
    const filled = draft.promptAnswers.filter((p) => p.answer.trim().length > 0);
    return (
      draft.bio.trim().length <= 150 &&
      draft.interests.length >= 1 &&
      draft.languages.length >= 1 &&
      draft.meetingIntent != null &&
      filled.length >= 1 &&
      filled.length <= 2
    );
  }, [draft]);

  const canContinue3 = useMemo(() => hasValidProfileLocation(draft), [draft]);

  const persistAndNext = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      Alert.alert('Setup', 'Configure Supabase in .env');
      return;
    }
    setSaving(true);
    const { error, uploadedPhotoUrls } = await saveOnboardingStep({
      userId: user.id,
      draft,
      existingPreferences: prefs,
      nextResumeStepIndex: Math.min(step + 1, ONBOARDING_TOTAL_STEPS - 1),
    });
    if (error) {
      setSaving(false);
      Alert.alert('Could not save', error.message);
      return;
    }
    setDraft((d) => mergeDraftAfterSave(d, uploadedPhotoUrls));
    setStep((s) => Math.min(s + 1, ONBOARDING_TOTAL_STEPS - 1));
    skipDraftHydrateRef.current = true;
    await refreshProfile();
    skipDraftHydrateRef.current = false;
    setSaving(false);
  }, [user?.id, draft, prefs, refreshProfile, step]);

  const onContinue = useCallback(async () => {
    if (step === 0 && !canContinue1) return;
    if (step === 1 && !canContinue2) return;
    if (step === 2 && !canContinue3) return;
    await persistAndNext();
  }, [step, canContinue1, canContinue2, canContinue3, persistAndNext]);

  const confirmSkipOnboarding = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error, uploadedPhotoUrls } = await finalizeOnboarding({
      userId: user.id,
      draft,
      existingPreferences: prefs,
      mode: 'skip',
    });
    if (error) {
      setSaving(false);
      Alert.alert('Could not save', error.message);
      return;
    }
    setDraft((d) => mergeDraftAfterSave(d, uploadedPhotoUrls));
    skipDraftHydrateRef.current = true;
    await markSoftKycPromptPending();
    await refreshProfile();
    skipDraftHydrateRef.current = false;
    setSaving(false);
    setShowSkipModal(false);
    router.replace('/(tabs)');
  }, [user?.id, draft, prefs, refreshProfile]);

  const finish = useCallback(
    async (mode: 'publish' | 'draft') => {
      if (!user?.id) return;
      setSaving(true);
      const { error, uploadedPhotoUrls } = await finalizeOnboarding({
        userId: user.id,
        draft,
        existingPreferences: prefs,
        mode: mode === 'draft' ? 'draft' : 'publish',
      });
      if (error) {
        setSaving(false);
        Alert.alert('Error', error.message);
        return;
      }
      setDraft((d) => mergeDraftAfterSave(d, uploadedPhotoUrls));
      skipDraftHydrateRef.current = true;
      await markSoftKycPromptPending();
      await refreshProfile();
      skipDraftHydrateRef.current = false;
      setSaving(false);
      router.replace('/(tabs)');
    },
    [user?.id, draft, prefs, refreshProfile]
  );

  if (!authReady && !activeSession?.user) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          style={[StyleSheet.absoluteFillObject, styles.center]}
        >
          <ActivityIndicator color={colors.primary} size="large" />
        </LinearGradient>
      </Screen>
    );
  }

  if (!activeSession?.user && !user) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  if (profile && !needsOnboarding(profile)) {
    return <Redirect href={postAuthHref(profile)} />;
  }

  const stepValid =
    step === 0
      ? canContinue1
      : step === 1
        ? canContinue2
        : step === 2
          ? canContinue3
          : step === 3
            ? true
            : true;

  const kbOffset = insets.top + 120;
  const stepLabel = ONBOARDING_STEP_LABELS[step] ?? 'Profile';
  const stepSubtitle = ONBOARDING_STEP_SUBTITLES[step] ?? '';

  function renderChoiceChip(label: string, selected: boolean, onPress: () => void) {
    return (
      <Pressable
        key={label}
        onPress={onPress}
        style={styles.chipOuter}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {selected ? (
          <LinearGradient
            colors={[colors.primary, '#8B7CE8', colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.chipGrad}
          >
            <Text style={styles.chipTxtOn}>{label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.chipIdle}>
            <Text style={styles.chipTxt}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <OnboardingStickyProgress step={step} total={ONBOARDING_TOTAL_STEPS} />

        {step > 0 ? (
          <Pressable
            onPress={() => setStep((s) => s - 1)}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}

        <View style={styles.leadBlock}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leadAccent}
          />
          <View style={styles.leadTextCol}>
            <Text style={styles.leadKicker}>Profile setup</Text>
            <Text style={styles.leadTitle}>{stepLabel}</Text>
            <Text style={styles.leadSub}>{stepSubtitle}</Text>
          </View>
        </View>

        <KeyboardAwareContainer keyboardVerticalOffset={kbOffset} style={styles.keyboardFill}>
          <KeyboardAwareScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, step === 4 && styles.scrollContentPreview]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <MotiView
              key={step}
              from={{ opacity: 0, translateX: 14 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 280 }}
            >
              <View style={styles.stepCard}>
          {step === 0 && (
            <View>
              <Input
                label="Display name"
                variant="onboarding"
                value={draft.displayName}
                onChangeText={(t) => setDraft((d) => ({ ...d, displayName: t }))}
                placeholder="How should we call you?"
              />
              <Text style={authSoftLabelStyle}>Birthday</Text>
              <Pressable
                style={onboardingTouchableFieldStyle(styles.dateBtn)}
                onPress={() => setShowDate(true)}
              >
                <Text style={styles.dateTxt}>
                  {draft.birthDate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </Pressable>
              {showDate && (
                <DateTimePicker
                  value={draft.birthDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  minimumDate={new Date(1940, 0, 1)}
                  onChange={(ev, date) => {
                    if (Platform.OS === 'android') setShowDate(false);
                    if (Platform.OS === 'android' && ev.type === 'dismissed') return;
                    if (date) setDraft((d) => ({ ...d, birthDate: date }));
                  }}
                />
              )}
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>I’m 18 or older</Text>
                <Switch
                  value={draft.adultConfirmed}
                  onValueChange={(v) => setDraft((d) => ({ ...d, adultConfirmed: v }))}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <PhotoUploader
                localUris={draft.localPhotoUris}
                remoteUrls={draft.remotePhotoUrls}
                onChangeLocal={(uris) => setDraft((d) => ({ ...d, localPhotoUris: uris }))}
                onRemoveLocal={(i) =>
                  setDraft((d) => ({
                    ...d,
                    localPhotoUris: d.localPhotoUris.filter((_, j) => j !== i),
                  }))
                }
                onRemoveRemote={(i) =>
                  setDraft((d) => ({
                    ...d,
                    remotePhotoUrls: d.remotePhotoUrls.filter((_, j) => j !== i),
                  }))
                }
              />
            </View>
          )}

          {step === 1 && (
            <View>
              <Input
                label={`Bio (${draft.bio.length}/150)`}
                variant="onboarding"
                multiline
                numberOfLines={4}
                maxLength={150}
                value={draft.bio}
                onChangeText={(t) => setDraft((d) => ({ ...d, bio: t }))}
                placeholder="What makes you… you?"
              />
              <TagSelector
                label="Interests"
                options={INTEREST_TAGS}
                selected={draft.interests}
                onToggle={(tag) =>
                  setDraft((d) => ({
                    ...d,
                    interests: d.interests.includes(tag)
                      ? d.interests.filter((x) => x !== tag)
                      : [...d.interests, tag].slice(0, 8),
                  }))
                }
              />
              <TagSelector
                label="Languages"
                options={LANGUAGE_OPTIONS}
                selected={draft.languages}
                max={5}
                onToggle={(tag) =>
                  setDraft((d) => ({
                    ...d,
                    languages: d.languages.includes(tag)
                      ? d.languages.filter((x) => x !== tag)
                      : [...d.languages, tag].slice(0, 5),
                  }))
                }
              />
              <Text style={[authSoftLabelStyle, styles.fieldLabelSpacing]}>Intent</Text>
              <View style={styles.intentRow}>
                {(['friendship', 'dating', 'activity', 'networking'] as MeetingIntent[]).map((k) => {
                  const label =
                    k === 'friendship'
                      ? 'Friendship'
                      : k === 'dating'
                        ? 'Dating'
                        : k === 'activity'
                          ? 'Activity partner'
                          : 'Networking';
                  return renderChoiceChip(label, draft.meetingIntent === k, () =>
                    setDraft((d) => ({ ...d, meetingIntent: k }))
                  );
                })}
              </View>
              <PromptSelector
                answers={draft.promptAnswers}
                onChange={(next) => setDraft((d) => ({ ...d, promptAnswers: next }))}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <ProfileLocationSection
                locationLabel={draft.locationLabel}
                locationLatitude={draft.locationLatitude}
                autoFillOnMount
                onApply={(patch) =>
                  setDraft((d) => ({
                    ...d,
                    locationLabel: patch.locationLabel,
                    locationLatitude: patch.locationLatitude,
                    locationLongitude: patch.locationLongitude,
                  }))
                }
                showRequiredHint={!canContinue3}
              />
              <Text style={[authSoftLabelStyle, styles.fieldLabelSpacing]}>I am</Text>
              <View style={styles.intentRow}>
                {['Woman', 'Man', 'Non-binary', 'Prefer not to say'].map((g) =>
                  renderChoiceChip(g, draft.selfGender === g, () => setDraft((d) => ({ ...d, selfGender: g })))
                )}
              </View>
              <Text style={[authSoftLabelStyle, styles.fieldLabelSpacing]}>Show me</Text>
              <View style={styles.intentRow}>
                {(['everyone', 'women', 'men'] as const).map((k) => {
                  const label = k === 'everyone' ? 'Everyone' : k === 'women' ? 'Women' : 'Men';
                  return renderChoiceChip(label, draft.showMe === k, () => setDraft((d) => ({ ...d, showMe: k })));
                })}
              </View>
              <Text style={styles.sliderLabel}>
                Age range: {draft.ageMin} – {draft.ageMax}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={75}
                step={1}
                value={draft.ageMin}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="rgba(108,99,255,0.15)"
                thumbTintColor={colors.primary}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    ageMin: Math.min(Math.round(v), d.ageMax - 1),
                  }))
                }
              />
              <Slider
                style={styles.slider}
                minimumValue={19}
                maximumValue={80}
                step={1}
                value={draft.ageMax}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="rgba(108,99,255,0.15)"
                thumbTintColor={colors.primary}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    ageMax: Math.max(Math.round(v), d.ageMin + 1),
                  }))
                }
              />
              <Text style={styles.sliderLabel}>Distance: {Math.round(draft.radiusKm)} km</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={draft.radiusKm}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="rgba(108,99,255,0.15)"
                thumbTintColor={colors.primary}
                onValueChange={(v) => setDraft((d) => ({ ...d, radiusKm: v }))}
              />
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Profile visible</Text>
                <Switch
                  value={draft.profilePublic}
                  onValueChange={(v) => setDraft((d) => ({ ...d, profilePublic: v }))}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              {SAFETY_TIPS.map((t) => (
                <LinearGradient
                  key={t.title}
                  colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tipCardBorder}
                >
                  <View style={styles.tipCard}>
                    <Text style={styles.tipIcon}>{t.icon}</Text>
                    <View style={styles.tipTextCol}>
                      <Text style={styles.tipTitle}>{t.title}</Text>
                      <Text style={styles.tipBody}>{t.body}</Text>
                    </View>
                  </View>
                </LinearGradient>
              ))}
              <Pressable
                style={styles.secondaryBtn}
                onPress={() =>
                  Alert.alert(
                    'Contacts',
                    'Contact import isn’t enabled in this build. You can block users anytime from their profile.',
                    [{ text: 'OK' }]
                  )
                }
              >
                <Text style={styles.secondaryBtnTxt}>Import / block contacts (optional)</Text>
              </Pressable>
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>I’ve read these tips</Text>
                <Switch
                  value={draft.safetyTipsAcknowledged}
                  onValueChange={(v) => setDraft((d) => ({ ...d, safetyTipsAcknowledged: v }))}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.previewHint}>
                Lead with your best photo and prompts that start real chats. You can edit everything later from
                Profile.
              </Text>
              <ProfileCardPreview draft={draft} />
            </View>
          )}
              </View>
            </MotiView>
          </KeyboardAwareScrollView>
        </KeyboardAwareContainer>

      {step < 4 ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => setShowSkipModal(true)}
              hitSlop={8}
              style={({ pressed }) => [styles.footerSkip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text style={styles.skipTxt}>Skip</Text>
            </Pressable>
            <Button
              title="Continue"
              onPress={onContinue}
              loading={saving}
              disabled={!stepValid || saving}
              gradient
              pill
              style={styles.footerContinue}
            />
          </View>
        </View>
      ) : step === 4 ? (
        <View style={[styles.previewFooter, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <Button
            title="Edit from step 1"
            variant="ghost"
            onPress={() => setStep(0)}
            disabled={saving}
          />
          <Button
            title="Save as draft"
            variant="secondary"
            onPress={() => finish('draft')}
            loading={saving}
            style={styles.previewFooterMid}
          />
          <Button
            title="Publish and go to Home"
            onPress={() => finish('publish')}
            loading={saving}
            gradient
            fullWidth
            pill
            style={styles.previewFooterPrimary}
          />
        </View>
      ) : null}

        <AppConfirmModal
          visible={showSkipModal}
          onClose={() => !saving && setShowSkipModal(false)}
          kicker="Profile setup"
          title="Skip for now?"
          message="Your progress so far will be saved. You can finish your profile anytime from the Profile tab."
          iconVariant="warning"
          primaryLabel="Keep going"
          onPrimary={() => setShowSkipModal(false)}
          secondaryLabel="Skip"
          onSecondary={confirmSkipOnboarding}
          secondaryTone="danger"
          busyOn="secondary"
          dismissOnBackdrop={!saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  keyboardFill: { flex: 1 },
  skipTxt: { fontSize: 14, fontWeight: '800', color: colors.primary },
  pressed: { opacity: 0.92 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: onboarding.glassBorder,
    marginLeft: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  scrollContentPreview: { paddingBottom: 24 },
  stepCard: {
    backgroundColor: onboarding.cardBg,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: onboarding.glassBorder,
    ...onboarding.shadow,
  },
  previewHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 21,
    fontWeight: '600',
  },
  fieldLabelSpacing: { marginBottom: 8 },
  dateBtn: { marginBottom: spacing.md },
  dateTxt: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  switchLabel: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  intentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  chipOuter: { borderRadius: radius.button, overflow: 'hidden' },
  chipGrad: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipIdle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  chipTxt: { fontSize: 13, fontWeight: '800', color: colors.text },
  chipTxtOn: { fontSize: 13, fontWeight: '900', color: '#fff' },
  sliderLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  slider: { width: '100%', height: 44, marginBottom: spacing.md },
  tipCardBorder: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.xl - 1,
    backgroundColor: onboarding.cardBg,
  },
  tipTextCol: { flex: 1, minWidth: 0 },
  tipIcon: { fontSize: 28 },
  tipTitle: { fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  tipBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20, fontWeight: '600' },
  secondaryBtn: {
    padding: 14,
    alignItems: 'center',
    marginVertical: spacing.md,
    borderRadius: radius.button,
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: '800', color: colors.primary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  footerSkip: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  footerContinue: {
    flex: 1,
    minWidth: 0,
  },
  previewFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  previewFooterMid: { marginTop: 0 },
  previewFooterPrimary: { marginTop: 0 },
});
