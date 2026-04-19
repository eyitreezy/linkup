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
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { PhotoUploader } from '@/components/onboarding/PhotoUploader';
import { ProfileCardPreview } from '@/components/onboarding/ProfileCardPreview';
import { PromptSelector } from '@/components/onboarding/PromptSelector';
import { TagSelector } from '@/components/onboarding/TagSelector';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  INTEREST_TAGS,
  LANGUAGE_OPTIONS,
  ONBOARDING_TOTAL_STEPS,
  SAFETY_TIPS,
} from '@/lib/onboarding/constants';
import { draftFromProfile, ageFromBirthDate } from '@/lib/onboarding/hydrate';
import {
  finalizeOnboarding,
  persistOnboardingResumeStep,
  saveOnboardingStep,
} from '@/lib/onboarding/persist';
import { markSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { defaultOnboardingDraft } from '@/types/onboarding';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  /** Keep draft in sync when profile loads / updates (after saves). */
  useLayoutEffect(() => {
    if (!profile) return;
    setDraft(draftFromProfile(profile));
  }, [profile?.user_id, profile?.updated_at]);

  /**
   * Restore wizard step only when the signed-in user changes — NOT on every profile refresh.
   * Otherwise `refreshProfile()` after "Continue" re-ran with stale `onboarding_step` and reset
   * the step index (e.g. bouncing back from step 2 to step 1).
   */
  useLayoutEffect(() => {
    if (!profile?.user_id) return;
    const raw = profile.preferences?.onboarding_step;
    const idx =
      typeof raw === 'number' && Number.isFinite(raw)
        ? Math.max(0, Math.min(Math.floor(raw), ONBOARDING_TOTAL_STEPS - 1))
        : 0;
    setStep(idx);
  }, [profile?.user_id]);

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
      adultConfirmed &&
      age >= 18
    );
  }, [draft.displayName, draft.localPhotoUris.length, draft.remotePhotoUrls.length, draft.birthDate, adultConfirmed]);

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
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await refreshProfile();
    setDraft((d) => ({
      ...d,
      localPhotoUris: [],
      remotePhotoUrls: [...d.remotePhotoUrls, ...uploadedPhotoUrls],
    }));
    setStep((s) => Math.min(s + 1, ONBOARDING_TOTAL_STEPS - 1));
  }, [user?.id, draft, prefs, refreshProfile, step]);

  const onContinue = useCallback(async () => {
    if (step === 0 && !canContinue1) return;
    if (step === 1 && !canContinue2) return;
    await persistAndNext();
  }, [step, canContinue1, canContinue2, persistAndNext]);

  const onSkipFlow = useCallback(() => {
    Alert.alert(
      'Skip onboarding?',
      'You can finish your profile later from the Profile tab.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setSaving(true);
            const { error } = await finalizeOnboarding({
              userId: user.id,
              draft,
              existingPreferences: prefs,
              mode: 'skip',
            });
            setSaving(false);
            if (error) Alert.alert('Error', error.message);
            else {
              await markSoftKycPromptPending();
              await refreshProfile();
              router.replace('/(tabs)');
            }
          },
        },
      ]
    );
  }, [user?.id, draft, prefs, profile, refreshProfile]);

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
      setSaving(false);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setDraft((d) => ({
        ...d,
        localPhotoUris: [],
        remotePhotoUrls: [...d.remotePhotoUrls, ...uploadedPhotoUrls],
      }));
      await markSoftKycPromptPending();
      await refreshProfile();
      router.replace('/(tabs)');
    },
    [user?.id, draft, prefs, profile, refreshProfile]
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={onboarding.accent} size="large" />
      </View>
    );
  }

  const stepValid =
    step === 0
      ? canContinue1
      : step === 1
        ? canContinue2
        : step === 2 || step === 3
          ? true
          : true;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (step > 0 ? setStep((s) => s - 1) : router.back())} hitSlop={12}>
          <Text style={styles.back}>{step > 0 ? '← Back' : ' '}</Text>
        </Pressable>
        <Pressable onPress={onSkipFlow} hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <OnboardingProgress step={step} total={ONBOARDING_TOTAL_STEPS} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, step === 4 && styles.scrollContentPreview]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MotiView
          key={step}
          from={{ opacity: 0, translateX: 16 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 280 }}
        >
          {step === 0 && (
            <View>
              <Text style={styles.title}>Basics</Text>
              <Text style={styles.sub}>A name, a birthday, and one photo — quick.</Text>
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
                <Switch value={adultConfirmed} onValueChange={setAdultConfirmed} trackColor={{ true: onboarding.accent }} />
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
              <Text style={styles.title}>Personality</Text>
              <Text style={styles.sub}>Short bio, tags, and a prompt or two.</Text>
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
                {(['friendship', 'dating', 'activity', 'networking'] as MeetingIntent[]).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setDraft((d) => ({ ...d, meetingIntent: k }))}
                    style={[styles.intentChip, draft.meetingIntent === k && styles.intentChipOn]}
                  >
                    <Text style={[styles.intentTxt, draft.meetingIntent === k && styles.intentTxtOn]}>
                      {k === 'friendship'
                        ? 'Friendship'
                        : k === 'dating'
                          ? 'Dating'
                          : k === 'activity'
                            ? 'Activity partner'
                            : 'Networking'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <PromptSelector
                answers={draft.promptAnswers}
                onChange={(next) => setDraft((d) => ({ ...d, promptAnswers: next }))}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>Preferences</Text>
              <Text style={styles.sub}>Who you’d like to meet — adjust fast.</Text>
              <Text style={[authSoftLabelStyle, styles.fieldLabelSpacing]}>I am</Text>
              <View style={styles.intentRow}>
                {['Woman', 'Man', 'Non-binary', 'Prefer not to say'].map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setDraft((d) => ({ ...d, selfGender: g }))}
                    style={[styles.intentChip, draft.selfGender === g && styles.intentChipOn]}
                  >
                    <Text style={[styles.intentTxt, draft.selfGender === g && styles.intentTxtOn]}>{g}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[authSoftLabelStyle, styles.fieldLabelSpacing]}>Show me</Text>
              <View style={styles.intentRow}>
                {(['everyone', 'women', 'men'] as const).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setDraft((d) => ({ ...d, showMe: k }))}
                    style={[styles.intentChip, draft.showMe === k && styles.intentChipOn]}
                  >
                    <Text style={[styles.intentTxt, draft.showMe === k && styles.intentTxtOn]}>
                      {k === 'everyone' ? 'Everyone' : k === 'women' ? 'Women' : 'Men'}
                    </Text>
                  </Pressable>
                ))}
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
                minimumTrackTintColor={onboarding.accent}
                maximumTrackTintColor="rgba(0,0,0,0.15)"
                thumbTintColor={onboarding.accent}
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
                minimumTrackTintColor={onboarding.accent}
                maximumTrackTintColor="rgba(0,0,0,0.15)"
                thumbTintColor={onboarding.accent}
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
                minimumTrackTintColor={onboarding.accent}
                maximumTrackTintColor="rgba(0,0,0,0.15)"
                thumbTintColor={onboarding.accent}
                onValueChange={(v) => setDraft((d) => ({ ...d, radiusKm: v }))}
              />
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Profile visible</Text>
                <Switch
                  value={draft.profilePublic}
                  onValueChange={(v) => setDraft((d) => ({ ...d, profilePublic: v }))}
                  trackColor={{ true: onboarding.accent }}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Safety</Text>
              <Text style={styles.sub}>A few quick tips — stay in control.</Text>
              {SAFETY_TIPS.map((t) => (
                <View key={t.title} style={styles.tipCard}>
                  <Text style={styles.tipIcon}>{t.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipTitle}>{t.title}</Text>
                    <Text style={styles.tipBody}>{t.body}</Text>
                  </View>
                </View>
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
                  trackColor={{ true: onboarding.accent }}
                />
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.title}>Preview</Text>
              <Text style={styles.sub}>
                Lead with your best photo, add interests people can scan in seconds, and prompts that start real
                chats — built like the swipe apps you know: big visual first, then story blocks, then polish.
              </Text>
              <Text style={styles.previewHint}>
                You can still edit everything later from Profile.
              </Text>
              <ProfileCardPreview draft={draft} />
            </View>
          )}
        </MotiView>
      </ScrollView>

      {step < 4 ? (
        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={onContinue}
            loading={saving}
            disabled={!stepValid || saving}
            pill
          />
        </View>
      ) : step === 4 ? (
        <View style={styles.previewFooter}>
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
            pill
            style={styles.previewFooterPrimary}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: onboarding.spacing.md,
    marginBottom: onboarding.spacing.sm,
  },
  back: { fontSize: 16, fontWeight: '600', color: colors.text },
  skip: { fontSize: 15, fontWeight: '700', color: onboarding.muted },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: onboarding.spacing.lg, paddingBottom: 120 },
  /** Step 5 (preview): primary actions live in sticky footer — less bottom padding in scroll */
  scrollContentPreview: { paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: onboarding.text, marginBottom: 6 },
  sub: { fontSize: 15, color: onboarding.muted, marginBottom: onboarding.spacing.sm, lineHeight: 22 },
  previewHint: {
    fontSize: 13,
    color: onboarding.muted,
    marginBottom: onboarding.spacing.lg,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  /** Extra spacing below labels that sit above chip rows (authSoftLabelStyle already sets base margin). */
  fieldLabelSpacing: { marginBottom: 8 },
  dateBtn: {
    marginBottom: onboarding.spacing.md,
  },
  dateTxt: { fontSize: 16, fontWeight: '500', color: colors.text },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: onboarding.spacing.lg,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: onboarding.text, flex: 1 },
  intentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: onboarding.spacing.lg },
  intentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  intentChipOn: { backgroundColor: onboarding.accentSoft, borderWidth: 1, borderColor: onboarding.accent },
  intentTxt: { fontSize: 14, fontWeight: '600', color: onboarding.text },
  intentTxtOn: { color: onboarding.accent },
  sliderLabel: { fontSize: 14, fontWeight: '600', color: onboarding.text, marginBottom: 4 },
  slider: { width: '100%', height: 44, marginBottom: onboarding.spacing.md },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    padding: onboarding.spacing.md,
    borderRadius: onboarding.radius2xl,
    backgroundColor: '#fff',
    marginBottom: onboarding.spacing.sm,
    ...onboarding.shadow,
  },
  tipIcon: { fontSize: 28 },
  tipTitle: { fontSize: 16, fontWeight: '800', color: onboarding.text },
  tipBody: { fontSize: 14, color: onboarding.muted, marginTop: 4, lineHeight: 20 },
  secondaryBtn: {
    padding: 14,
    alignItems: 'center',
    marginVertical: onboarding.spacing.md,
    borderRadius: radius.button,
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: '700', color: onboarding.accent },
  mt: { marginTop: onboarding.spacing.md },
  mtSm: { marginTop: onboarding.spacing.sm },
  footer: {
    padding: onboarding.spacing.lg,
    paddingBottom: onboarding.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#E8EAEF',
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      default: {},
    }),
  },
  /** Sticky action stack — matches common dating-app final step (outline edit → secondary save → primary publish) */
  previewFooter: {
    paddingHorizontal: onboarding.spacing.lg,
    paddingTop: onboarding.spacing.md,
    paddingBottom: onboarding.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#E8EAEF',
    backgroundColor: colors.surface,
    gap: onboarding.spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      default: {},
    }),
  },
  previewFooterMid: { marginTop: 0 },
  previewFooterPrimary: { marginTop: 0 },
});
