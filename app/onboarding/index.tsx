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
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { ProfilePhotoGallery } from '@/components/profile/ProfilePhotoGallery';
import { ProfileVideoUploader } from '@/components/profile/ProfileVideoUploader';
import { PROFILE_MIN_PHOTOS_ONBOARDING } from '@/lib/profile/media/constants';
import { defaultPrimaryRef } from '@/lib/profile/media/photoOrder';
import { ProfileCardPreview } from '@/components/onboarding/ProfileCardPreview';
import { PromptSelector } from '@/components/onboarding/PromptSelector';
import { TagSelector } from '@/components/onboarding/TagSelector';
import { ProfileLocationSection } from '@/components/profile/ProfileLocationSection';
import { KeyboardSafeScrollView } from '@/components/layout/KeyboardSafeScrollView';
import { colors, radius, spacing, fonts } from '@/constants/theme';
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
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import {
  draftFromProfile,
  ageFromBirthDate,
  mergeDraftAfterSave,
  enrichDraftWithProfileVideo,
  fetchProfileVideoDraftPatch,
} from '@/lib/onboarding/hydrate';
import {
  finalizeOnboarding,
  persistOnboardingResumeStep,
  saveOnboardingStep,
} from '@/lib/onboarding/persist';
import {
  getOnboardingFinishBlocker,
  getOnboardingFinishBlockerStep,
  getOnboardingValidationFocus,
  type OnboardingValidationFocus,
} from '@/lib/onboarding/validation';
import { userFacingOnboardingSaveError } from '@/lib/onboarding/userFacingError';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { markSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import { linkInvitationAfterSignup } from '@/lib/plans/planInvitations';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { normalizeEmail, normalizePhone } from '@/lib/contacts/hashContact';
import { hashContactValue } from '@/lib/contacts/hashContactValue';
import * as Contacts from 'expo-contacts';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { defaultOnboardingDraft } from '@/types/onboarding';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const { invitation_token: invitationTokenParam } = useLocalSearchParams<{
    invitation_token?: string;
  }>();
  const invitationTokenRef = useRef(
    typeof invitationTokenParam === 'string' ? invitationTokenParam : undefined
  );
  if (typeof invitationTokenParam === 'string' && invitationTokenParam) {
    invitationTokenRef.current = invitationTokenParam;
  }

  const { session, profile, refreshProfile, loading: authLoading } = useAuth();
  const { user, session: activeSession, ready: authReady } = useAuthBootstrap();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    variant: AppFeedbackVariant;
  } | null>(null);
  const [contactsImportStatus, setContactsImportStatus] = useState<'idle' | 'imported' | 'denied'>('idle');
  const [validationFocus, setValidationFocus] = useState<OnboardingValidationFocus | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const hydratedUserRef = useRef<string | null>(null);
  const skipDraftHydrateRef = useRef(false);
  const stepRestoredRef = useRef(false);

  /** Prefill draft once per signed-in user — not on every profile refresh (avoids wiping fields after Continue). */
  useLayoutEffect(() => {
    if (!profile?.user_id || skipDraftHydrateRef.current) return;
    if (hydratedUserRef.current === profile.user_id) return;
    hydratedUserRef.current = profile.user_id;
    const base = draftFromProfile(profile);
    setDraft(base);
    void fetchProfileVideoDraftPatch(profile.user_id).then((patch) => {
      if (!patch) return;
      setDraft((d) => ({ ...d, ...patch }));
    });
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
    stepRestoredRef.current = true;
  }, [profile?.user_id, profile?.onboarding_status]);

  /** Persist resume index when the user moves between steps — not on every profile/preferences refresh (would race with `refreshProfile` after Continue). */
  useEffect(() => {
    if (!stepRestoredRef.current) return;
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
    const hasVideo = draft.videos.some((v) => v.localUri || v.remoteUrl);
    const age = ageFromBirthDate(draft.birthDate);
    return (
      draft.displayName.trim().length >= 1 &&
      photos >= PROFILE_MIN_PHOTOS_ONBOARDING &&
      hasVideo &&
      draft.adultConfirmed &&
      age >= 18
    );
  }, [
    draft.displayName,
    draft.localPhotoUris.length,
    draft.remotePhotoUrls.length,
    draft.videos,
    draft.birthDate,
    draft.adultConfirmed,
  ]);

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
      setFeedback({
        variant: 'warning',
        title: 'Setup required',
        message: 'Configure Supabase in .env before continuing.',
      });
      return;
    }
    setSaving(true);
    Keyboard.dismiss();
    const { error, uploadedPhotoUrls } = await saveOnboardingStep({
      userId: user.id,
      draft,
      existingPreferences: prefs,
      nextResumeStepIndex: Math.min(step + 1, ONBOARDING_TOTAL_STEPS - 1),
    });
    if (error) {
      setSaving(false);
      setFeedback({
        variant: 'error',
        title: 'Could not save',
        message: userFacingOnboardingSaveError(error.message),
      });
      return;
    }
    const merged = mergeDraftAfterSave(draft, uploadedPhotoUrls);
    const enriched = await enrichDraftWithProfileVideo(user.id, merged);
    setDraft(enriched);
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

  const routeAfterOnboarding = useCallback(async () => {
    const token = invitationTokenRef.current;
    if (token && isSupabaseConfigured) {
      try {
        const linked = await linkInvitationAfterSignup(token);
        if (linked.linked && linked.planId && linked.invitationId) {
          router.replace(
            `/plan/${linked.planId}/invitation/${linked.invitationId}` as Href
          );
          return;
        }
      } catch {
        /* fall through to default route */
      }
    }
    router.replace('/(tabs)');
  }, []);

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
      setFeedback({
        variant: 'error',
        title: 'Could not save',
        message: userFacingOnboardingSaveError(error.message),
      });
      return;
    }
    setDraft((d) => mergeDraftAfterSave(d, uploadedPhotoUrls));
    skipDraftHydrateRef.current = true;
    await markSoftKycPromptPending();
    await refreshProfile();
    skipDraftHydrateRef.current = false;
    setSaving(false);
    setShowSkipModal(false);
    await routeAfterOnboarding();
  }, [user?.id, draft, prefs, refreshProfile, routeAfterOnboarding]);

  const finish = useCallback(
    async (mode: 'publish' | 'draft') => {
      if (!user?.id) return;

      if (mode === 'publish') {
        const blocker = getOnboardingFinishBlocker(draft);
        if (blocker) {
          const targetStep = getOnboardingFinishBlockerStep(draft);
          setValidationFocus(getOnboardingValidationFocus(draft));
          setValidationMessage(blocker);
          setStep(targetStep);
          setFeedback({
            variant: 'warning',
            title: 'Almost there',
            message: blocker,
          });
          return;
        }
      }

      setSaving(true);
      setValidationFocus(null);
      setValidationMessage(null);
      const { error, uploadedPhotoUrls } = await finalizeOnboarding({
        userId: user.id,
        draft,
        existingPreferences: prefs,
        mode: mode === 'draft' ? 'draft' : 'publish',
      });
      if (error) {
        setSaving(false);
        setShowSaveDraftModal(false);
        const targetStep = getOnboardingFinishBlockerStep(draft);
        setValidationFocus(getOnboardingValidationFocus(draft));
        setValidationMessage(error.message);
        if (mode === 'publish') setStep(targetStep);
        setFeedback({
          variant: 'error',
          title: mode === 'draft' ? 'Could not save draft' : 'Could not finish',
          message: userFacingOnboardingSaveError(error.message),
        });
        return;
      }
      setDraft((d) => mergeDraftAfterSave(d, uploadedPhotoUrls));
      skipDraftHydrateRef.current = true;
      await markSoftKycPromptPending();
      await refreshProfile();
      skipDraftHydrateRef.current = false;
      setSaving(false);
      setShowSaveDraftModal(false);
      await routeAfterOnboarding();
    },
    [user?.id, draft, prefs, refreshProfile, routeAfterOnboarding]
  );

  const confirmSaveDraft = useCallback(() => {
    setShowSaveDraftModal(true);
  }, []);

  const handleContactsImport = useCallback(async () => {
    if (!user?.id) return;
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setContactsImportStatus('denied');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });

    const hashPromises = data.flatMap((c) => [
      ...(c.phoneNumbers?.map((p) =>
        p.number ? hashContactValue(normalizePhone(p.number)) : Promise.resolve('')
      ) ?? []),
      ...(c.emails?.map((e) =>
        e.email ? hashContactValue(normalizeEmail(e.email)) : Promise.resolve('')
      ) ?? []),
    ]);
    const hashedContacts = (await Promise.all(hashPromises)).filter(Boolean);

    const mergedPrefs = {
      ...(prefs ?? {}),
      contacts_imported: true,
      contacts_hash_count: hashedContacts.length,
    };
    await supabase.from('profiles').update({ preferences: mergedPrefs }).eq('user_id', user.id);

    if (hashedContacts.length > 0) {
      await supabase.from('contact_hashes').upsert(
        hashedContacts.map((hash) => ({ user_id: user.id, contact_hash: hash })),
        { onConflict: 'user_id,contact_hash' }
      );
    }

    setContactsImportStatus('imported');
  }, [user?.id, prefs]);

  const showBootstrapSpinner = (!authReady && !activeSession?.user) || (!!activeSession?.user && authLoading);

  if (showBootstrapSpinner) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={[styles.flex, styles.center]}>
          <AppShellBackground />
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
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
        <AppShellBackground />

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

        <KeyboardSafeScrollView
          style={styles.keyboardFill}
          contentContainerStyle={[styles.scrollContent, step === 4 && styles.scrollContentPreview]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          footer={
            step < 4 ? (
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
                <View style={styles.footerRow}>
                  {step > 0 ? (
                    <Pressable
                      onPress={() => setShowSkipModal(true)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.footerSkip, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Skip onboarding"
                    >
                      <Text style={styles.skipTxt}>Skip</Text>
                    </Pressable>
                  ) : null}
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
                  onPress={confirmSaveDraft}
                  loading={saving}
                  style={styles.previewFooterMid}
                />
                <Button
                  title="Finish & Go to Discover"
                  onPress={() => finish('publish')}
                  loading={saving}
                  gradient
                  fullWidth
                  pill
                  style={styles.previewFooterPrimary}
                />
              </View>
            ) : null
          }
        >
            <MotiView
              key={step}
              from={{ opacity: 0, translateX: 14 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 280 }}
            >
              <View style={styles.stepCard}>
          {validationMessage && step < 4 ? (
            <View style={styles.validationBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.validationBannerText}>{validationMessage}</Text>
            </View>
          ) : null}
          {step === 0 && (
            <View>
              <Input
                label="Display name"
                variant="onboarding"
                value={draft.displayName}
                onChangeText={(t) => {
                  setValidationFocus(null);
                  setValidationMessage(null);
                  setDraft((d) => ({ ...d, displayName: t }));
                }}
                placeholder="How should we call you?"
                error={
                  validationFocus === 'displayName' && validationMessage
                    ? validationMessage
                    : undefined
                }
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
              <ProfilePhotoGallery
                localUris={draft.localPhotoUris}
                remoteUrls={draft.remotePhotoUrls}
                primaryRef={draft.primaryPhotoRef}
                highlightError={validationFocus === 'photos' ? validationMessage : null}
                onChangeLocal={(uris) =>
                  setDraft((d) => ({
                    ...d,
                    localPhotoUris: uris,
                    primaryPhotoRef: d.primaryPhotoRef ?? defaultPrimaryRef(d.remotePhotoUrls, uris),
                  }))
                }
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
                onPrimaryChange={(ref) => setDraft((d) => ({ ...d, primaryPhotoRef: ref }))}
              />
              <ProfileVideoUploader
                videos={draft.videos}
                required
                highlightError={validationFocus === 'video' ? validationMessage : null}
                onPickSuccess={() => {
                  setValidationFocus(null);
                  setValidationMessage(null);
                }}
                onAddVideo={(uri) =>
                  setDraft((d) => ({
                    ...d,
                    videos: [...d.videos, { localUri: uri, remoteUrl: null, mediaId: null }],
                  }))
                }
                onRemoveVideo={(index) =>
                  setDraft((d) => ({
                    ...d,
                    videos: d.videos.filter((_, i) => i !== index),
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
                showRequiredHint={
                  validationFocus === 'location' ? true : !canContinue3
                }
                validationMessage={
                  validationFocus === 'location' ? validationMessage : null
                }
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
                maximumTrackTintColor="rgba(94, 82, 255,0.15)"
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
                maximumTrackTintColor="rgba(94, 82, 255,0.15)"
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
                maximumTrackTintColor="rgba(94, 82, 255,0.15)"
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
                  colors={['rgba(94, 82, 255,0.14)', 'rgba(255, 74, 114,0.08)']}
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
              <Pressable style={styles.secondaryBtn} onPress={() => void handleContactsImport()}>
                <View style={styles.contactsImportContent}>
                  <Text style={styles.secondaryBtnTxt}>Import contacts (optional)</Text>
                  <Text style={styles.contactsImportDesc}>
                    Helps us show safety context if you match with someone in your contacts. We never store your
                    contacts — only secure hashes for matching.
                  </Text>
                </View>
                {contactsImportStatus === 'imported' ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                ) : null}
                {contactsImportStatus === 'denied' ? (
                  <Text style={styles.contactsImportDenied}>Permission denied</Text>
                ) : null}
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
              <View style={styles.trialEducationCallout}>
                <Ionicons name="sparkles" size={16} color="#D97706" />
                <Text style={styles.trialEducationText}>
                  Want a free 7-day Silver trial? Verify your identity after publishing — approved verification
                  automatically starts your trial.
                </Text>
              </View>
            </View>
          )}
              </View>
            </MotiView>
          </KeyboardSafeScrollView>

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

        <AppConfirmModal
          visible={showSaveDraftModal}
          onClose={() => !saving && setShowSaveDraftModal(false)}
          kicker="Profile setup"
          title="Save as draft?"
          message="Your profile will be saved, but you'll need to publish or skip before you can browse Discover. You can come back to finish anytime."
          iconVariant="warning"
          primaryLabel="Keep editing"
          onPrimary={() => setShowSaveDraftModal(false)}
          secondaryLabel="Save draft"
          onSecondary={() => void finish('draft')}
          busyOn="secondary"
          dismissOnBackdrop={!saving}
        />

        <AppFeedbackModal
          visible={feedback != null}
          onClose={() => setFeedback(null)}
          variant={feedback?.variant ?? 'error'}
          kicker="Profile setup"
          title={feedback?.title ?? ''}
          message={feedback?.message ?? ''}
          primaryLabel="Got it"
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
  skipTxt: { fontSize: 14, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
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
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.medium,
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
    fontFamily: fonts.medium,
  },
  fieldLabelSpacing: { marginBottom: 8 },
  dateBtn: { marginBottom: spacing.md },
  dateTxt: { fontSize: 16, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.text },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  switchLabel: { fontSize: 15, fontWeight: '700',
    fontFamily: fonts.medium, color: colors.text, flex: 1 },
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
    borderColor: 'rgba(94, 82, 255, 0.22)',
  },
  chipTxt: { fontSize: 13, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  chipTxtOn: { fontSize: 13, fontWeight: '900', color: '#fff', fontFamily: fonts.bold, },
  sliderLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4, fontFamily: fonts.medium, },
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
  tipIcon: { fontSize: 28, fontFamily: fonts.regular, },
  tipTitle: { fontSize: 16, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.2 },
  tipBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
    marginVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    backgroundColor: 'rgba(94, 82, 255, 0.06)',
  },
  contactsImportContent: { flex: 1 },
  contactsImportDesc: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  contactsImportDenied: { fontSize: 12, fontWeight: '700',
    fontFamily: fonts.medium, color: colors.danger },
  trialEducationCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  trialEducationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 19,
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.12)',
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
    borderColor: 'rgba(94, 82, 255, 0.22)',
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
    borderTopColor: 'rgba(94, 82, 255, 0.12)',
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
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
  },
  validationBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.danger,
  },
});
