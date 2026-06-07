/**
 * Edit profile — same fields as post-onboarding (photos, bio, prompts, preferences).
 * Shell matches notification inbox + create-plan (gradient, cards, chips).
 */
import {
  authSoftLabelStyle,
  Input,
  onboardingTouchableFieldStyle,
} from '@/components/Input';
import { ProfilePhotoGallery } from '@/components/profile/ProfilePhotoGallery';
import { ProfileVideoUploader } from '@/components/profile/ProfileVideoUploader';
import { defaultPrimaryRef, orderPhotoUrls } from '@/lib/profile/media/photoOrder';
import { ProfileCardPreview } from '@/components/onboarding/ProfileCardPreview';
import { PromptSelector } from '@/components/onboarding/PromptSelector';
import { TagSelector } from '@/components/onboarding/TagSelector';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { INTEREST_TAGS, LANGUAGE_OPTIONS } from '@/lib/onboarding/constants';
import {
  ageFromBirthDate,
  draftFromProfile,
  fetchProfileVideoDraftPatch,
  mergeDraftAfterSave,
} from '@/lib/onboarding/hydrate';
import { ProfileLocationSection } from '@/components/profile/ProfileLocationSection';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { saveEditProfile } from '@/lib/profile/saveEditProfile';
import { persistModerationAfterSend } from '@/lib/trust/persistModeration';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { defaultOnboardingDraft } from '@/types/onboarding';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

function EditSectionHeader({ title, icon }: { title: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionAccentDot} />
        {icon ? <Ionicons name={icon} size={16} color={colors.primary} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionRule}
      />
    </View>
  );
}

function FormCard({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.formCardOuter}
    >
      <View style={styles.formCardInner}>{children}</View>
    </LinearGradient>
  );
}

function GradientChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.chipPress} accessibilityRole="button">
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

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);

  const canSave = useMemo(() => {
    const photos = draft.localPhotoUris.length + draft.remotePhotoUrls.length;
    const age = ageFromBirthDate(draft.birthDate);
    const filled = draft.promptAnswers.filter((p) => p.answer.trim().length > 0);
    return (
      draft.displayName.trim().length >= 1 &&
      photos >= 1 &&
      age >= 18 &&
      draft.bio.trim().length <= 150 &&
      draft.interests.length >= 1 &&
      draft.languages.length >= 1 &&
      draft.meetingIntent != null &&
      filled.length >= 1 &&
      filled.length <= 2 &&
      hasValidProfileLocation(draft)
    );
  }, [draft]);

  async function save() {
    if (!user?.id || !isSupabaseConfigured) return;
    if (!canSave) {
      setFeedback({
        variant: 'warning',
        title: 'Check your profile',
        message:
          'Need: display name, 18+ birthday, at least one photo, your location, bio (≤150 chars), interests, languages, intent, and 1–2 prompts.',
      });
      return;
    }
    setSaving(true);
    const { error, uploadedPhotoUrls } = await saveEditProfile({
      userId: user.id,
      draft,
      existingPreferences: profile?.preferences ?? null,
    });
    setSaving(false);
    if (error) {
      setFeedback({
        variant: 'error',
        title: 'Could not save',
        message: error.message,
      });
      return;
    }
    {
      const promptBits = draft.promptAnswers
        .filter((p) => p.answer.trim())
        .map((p) => `${p.prompt}: ${p.answer.trim()}`)
        .join('\n');
      const textSample = [draft.displayName.trim(), draft.bio.trim(), promptBits].filter(Boolean).join('\n');
      void persistModerationAfterSend({
        contentType: 'profile',
        contentId: user.id,
        textSample: textSample.length ? textSample : null,
      });
      await refreshProfile();
      setDraft((d) => mergeDraftAfterSave(d, uploadedPhotoUrls));
      setFeedback({
        variant: 'success',
        title: 'Saved',
        message: 'Your profile is updated and visible across LinkUp.',
      });
    }
  }

  useEffect(() => {
    if (!profile?.user_id) return;
    const base = draftFromProfile(profile);
    setDraft(base);
    void fetchProfileVideoDraftPatch(profile.user_id).then((patch) => {
      if (!patch) return;
      setDraft((d) => ({ ...d, ...patch }));
    });
  }, [profile?.user_id]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'success'}
        kicker="Edit profile"
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        primaryLabel={feedback?.variant === 'success' ? 'Done' : 'Got it'}
      />
      <SettingsStickyShell contentContainerStyle={styles.scroll}>
            <View style={styles.leadBlock}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.leadAccent}
              />
              <View style={styles.leadTextCol}>
                <Text style={styles.leadKicker}>Profile</Text>
                <Text style={styles.leadTitle}>Edit profile</Text>
                <Text style={styles.leadSub}>
                  Same fields as onboarding: photos, story, prompts, and discovery preferences stay in sync everywhere.
                </Text>
              </View>
            </View>

            <EditSectionHeader title="Basics" icon="person-outline" />
            <FormCard>
              <Input
                label="Display name"
                variant="onboardingFlat"
                value={draft.displayName}
                onChangeText={(t) => setDraft((d) => ({ ...d, displayName: t }))}
                placeholder="How you appear on LinkUp"
              />
              <Text style={[authSoftLabelStyle, styles.labelAfterInput]}>Birthday</Text>
              <Pressable style={onboardingTouchableFieldStyle(styles.dateRowInner)} onPress={() => setShowDate(true)}>
                <Text style={styles.dateTxt}>
                  {draft.birthDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </Pressable>
              {showDate ? (
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
              ) : null}
              <Text style={styles.photoRequirementHint}>Tap a photo to set Primary · intro video optional here</Text>
              <ProfilePhotoGallery
                localUris={draft.localPhotoUris}
                remoteUrls={draft.remotePhotoUrls}
                primaryRef={draft.primaryPhotoRef}
                minPhotosHint={1}
                onChangeLocal={(uris) =>
                  setDraft((d) => ({
                    ...d,
                    localPhotoUris: uris,
                    primaryPhotoRef: d.primaryPhotoRef ?? defaultPrimaryRef(d.remotePhotoUrls, uris),
                  }))
                }
                onRemoveLocal={(i) =>
                  setDraft((d) => ({ ...d, localPhotoUris: d.localPhotoUris.filter((_, j) => j !== i) }))
                }
                onRemoveRemote={(i) =>
                  setDraft((d) => ({ ...d, remotePhotoUrls: d.remotePhotoUrls.filter((_, j) => j !== i) }))
                }
                onPrimaryChange={(ref) =>
                  setDraft((d) => ({
                    ...d,
                    primaryPhotoRef: ref,
                    remotePhotoUrls:
                      ref?.kind === 'remote'
                        ? orderPhotoUrls(d.remotePhotoUrls, ref.url)
                        : d.remotePhotoUrls,
                  }))
                }
              />
              <ProfileVideoUploader
                localUri={draft.localVideoUri}
                remoteUrl={draft.remoteVideoUrl}
                onPickLocal={(uri) => setDraft((d) => ({ ...d, localVideoUri: uri }))}
                onRemove={() =>
                  setDraft((d) => ({
                    ...d,
                    localVideoUri: null,
                    remoteVideoUrl: null,
                  }))
                }
              />
            </FormCard>

            <EditSectionHeader title="Story & tags" icon="chatbox-ellipses-outline" />
            <FormCard>
              <Input
                label={`Bio (${draft.bio.length}/150)`}
                variant="onboardingFlat"
                multiline
                numberOfLines={4}
                maxLength={150}
                value={draft.bio}
                onChangeText={(t) => setDraft((d) => ({ ...d, bio: t }))}
                placeholder="A short line that shows your vibe"
              />
              <View style={styles.tagSectionAfterBio}>
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
              </View>
              <View style={styles.tagSectionAfterTags}>
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
              </View>
              <Text style={[authSoftLabelStyle, styles.labelAfterTags]}>Intent</Text>
              <View style={styles.chipRow}>
                {(['friendship', 'dating', 'activity', 'networking'] as MeetingIntent[]).map((k) => (
                  <GradientChip
                    key={k}
                    label={
                      k === 'friendship'
                        ? 'Friendship'
                        : k === 'dating'
                          ? 'Dating'
                          : k === 'activity'
                            ? 'Activity'
                            : 'Networking'
                    }
                    selected={draft.meetingIntent === k}
                    onPress={() => setDraft((d) => ({ ...d, meetingIntent: k }))}
                  />
                ))}
              </View>
              <PromptSelector
                answers={draft.promptAnswers}
                onChange={(next) => setDraft((d) => ({ ...d, promptAnswers: next }))}
                inputVariant="onboardingFlat"
              />
            </FormCard>

            <EditSectionHeader title="Discovery preferences" icon="options-outline" />
            <FormCard>
              <ProfileLocationSection
                locationLabel={draft.locationLabel}
                locationLatitude={draft.locationLatitude}
                onApply={(patch) =>
                  setDraft((d) => ({
                    ...d,
                    locationLabel: patch.locationLabel,
                    locationLatitude: patch.locationLatitude,
                    locationLongitude: patch.locationLongitude,
                  }))
                }
                showRequiredHint={!hasValidProfileLocation(draft)}
              />
              <Text style={[authSoftLabelStyle, styles.labelFirstInCard]}>I am</Text>
              <View style={styles.chipRow}>
                {['Woman', 'Man', 'Non-binary', 'Prefer not to say'].map((g) => (
                  <GradientChip
                    key={g}
                    label={g}
                    selected={draft.selfGender === g}
                    onPress={() => setDraft((d) => ({ ...d, selfGender: g }))}
                  />
                ))}
              </View>
              <Text style={[authSoftLabelStyle, styles.labelAfterChipRow]}>Show me</Text>
              <View style={styles.chipRow}>
                {(['everyone', 'women', 'men'] as const).map((k) => (
                  <GradientChip
                    key={k}
                    label={k === 'everyone' ? 'Everyone' : k === 'women' ? 'Women' : 'Men'}
                    selected={draft.showMe === k}
                    onPress={() => setDraft((d) => ({ ...d, showMe: k }))}
                  />
                ))}
              </View>
              <Text style={[authSoftLabelStyle, styles.controlLabelSection]}>
                Age range: {draft.ageMin} – {draft.ageMax}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={75}
                step={1}
                value={draft.ageMin}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    ageMin: Math.min(Math.round(v), d.ageMax - 1),
                  }))
                }
              />
              <Slider
                style={styles.sliderAgeMax}
                minimumValue={19}
                maximumValue={80}
                step={1}
                value={draft.ageMax}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    ageMax: Math.max(Math.round(v), d.ageMin + 1),
                  }))
                }
              />
              <Text style={[authSoftLabelStyle, styles.controlLabelSection]}>Distance: {Math.round(draft.radiusKm)} km</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={draft.radiusKm}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
                onValueChange={(v) => setDraft((d) => ({ ...d, radiusKm: v }))}
              />
              <View style={styles.rowBetween}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchLabel}>Profile visible</Text>
                  <Text style={styles.switchHint}>Hide from discovery if you need a break</Text>
                </View>
                <Switch
                  value={draft.profilePublic}
                  onValueChange={(v) => setDraft((d) => ({ ...d, profilePublic: v }))}
                  trackColor={{ false: 'rgba(26, 29, 38, 0.14)', true: colors.primary }}
                  ios_backgroundColor="rgba(26, 29, 38, 0.14)"
                />
              </View>
            </FormCard>

            <EditSectionHeader title="Preview" icon="eye-outline" />
            <View style={styles.previewSection}>
              <ProfileCardPreview draft={draft} fullWidth />
            </View>

            <Pressable
              onPress={() => void save()}
              disabled={saving || !canSave}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              style={({ pressed }) => [
                styles.saveOuter,
                (!canSave || saving) && styles.saveOuterDisabled,
                pressed && canSave && !saving && styles.savePressed,
              ]}
            >
              <LinearGradient
                colors={[colors.primary, '#8B7CE8', colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveGrad}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.saveTxt}>{saving ? 'Saving…' : 'Save profile'}</Text>
              </LinearGradient>
            </Pressable>
            {!canSave ? (
              <Text style={styles.saveHint}>Complete required fields above to enable save.</Text>
            ) : null}
      </SettingsStickyShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 56,
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
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  sectionHead: {
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionAccentDot: {
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
    flex: 1,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  formCardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.md,
  },
  formCardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  previewSection: {
    width: '100%',
    marginBottom: spacing.md,
  },
  /** Tighter rhythm after `Input` (wrap already adds margin below). */
  labelAfterInput: { marginTop: spacing.sm },
  labelAfterTags: { marginTop: spacing.lg },
  labelFirstInCard: { marginTop: 0 },
  labelAfterChipRow: { marginTop: spacing.md },
  controlLabelSection: { marginTop: spacing.md },
  photoRequirementHint: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  tagSectionAfterBio: { marginTop: spacing.md },
  tagSectionAfterTags: { marginTop: spacing.lg },
  dateRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTxt: { fontSize: 16, color: colors.text, fontWeight: '600', flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  chipPress: { borderRadius: radius.button, overflow: 'hidden' },
  chipGrad: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipIdle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  chipTxt: { fontSize: 13, fontWeight: '800', color: colors.text },
  chipTxtOn: { fontSize: 13, fontWeight: '900', color: '#fff', textAlign: 'center' },
  slider: { width: '100%', height: 40, marginBottom: spacing.sm },
  sliderAgeMax: { width: '100%', height: 40, marginBottom: spacing.md },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26,29,38,0.08)',
    gap: spacing.md,
  },
  switchCopy: { flex: 1, minWidth: 0 },
  switchLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  switchHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  saveOuter: {
    marginTop: spacing.lg,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#6C63FF',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 14,
        }
      : { elevation: 5 }),
  },
  saveOuterDisabled: { opacity: 0.42 },
  savePressed: { opacity: 0.94, transform: [{ scale: 0.98 }] },
  saveGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: spacing.lg,
  },
  saveTxt: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  saveHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
