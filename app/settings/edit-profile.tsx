/**
 * Edit profile — same fields as post-onboarding (photos, bio, prompts, preferences).
 */
import {
  authSoftLabelStyle,
  Input,
  onboardingTouchableFieldStyle,
} from '@/components/Input';
import { PhotoUploader } from '@/components/onboarding/PhotoUploader';
import { ProfileCardPreview } from '@/components/onboarding/ProfileCardPreview';
import { PromptSelector } from '@/components/onboarding/PromptSelector';
import { TagSelector } from '@/components/onboarding/TagSelector';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { INTEREST_TAGS, LANGUAGE_OPTIONS } from '@/lib/onboarding/constants';
import { ageFromBirthDate, draftFromProfile } from '@/lib/onboarding/hydrate';
import { saveEditProfile } from '@/lib/profile/saveEditProfile';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { MeetingIntent, OnboardingDraft } from '@/types/onboarding';
import { defaultOnboardingDraft } from '@/types/onboarding';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

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
      filled.length <= 2
    );
  }, [draft]);

  async function save() {
    if (!user?.id || !isSupabaseConfigured) return;
    if (!canSave) {
      Alert.alert(
        'Check your profile',
        'Need: display name, 18+ birthday, at least one photo, bio (≤150 chars), interests, languages, intent, and 1–2 prompts.'
      );
      return;
    }
    setSaving(true);
    const { error } = await saveEditProfile({
      userId: user.id,
      draft,
      existingPreferences: profile?.preferences ?? null,
    });
    setSaving(false);
    if (error) Alert.alert('Could not save', error.message);
    else {
      await refreshProfile();
      Alert.alert('Saved', 'Profile updated.');
    }
  }

  useEffect(() => {
    if (!profile) return;
    setDraft(draftFromProfile(profile));
  }, [profile?.user_id, profile?.updated_at]);

  return (
    <Screen scroll>
      <Text style={styles.lead}>
        Update the same details you set during onboarding — photos, story, and discovery preferences stay in sync everywhere.
      </Text>

      <Text style={styles.section}>Basics</Text>
      <Input label="Display name" value={draft.displayName} onChangeText={(t) => setDraft((d) => ({ ...d, displayName: t }))} />
      <Text style={authSoftLabelStyle}>Birthday</Text>
      <Pressable style={onboardingTouchableFieldStyle(styles.dateBtn)} onPress={() => setShowDate(true)}>
        <Text style={styles.dateTxt}>
          {draft.birthDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
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

      <PhotoUploader
        localUris={draft.localPhotoUris}
        remoteUrls={draft.remotePhotoUrls}
        onChangeLocal={(uris) => setDraft((d) => ({ ...d, localPhotoUris: uris }))}
        onRemoveLocal={(i) =>
          setDraft((d) => ({ ...d, localPhotoUris: d.localPhotoUris.filter((_, j) => j !== i) }))
        }
        onRemoveRemote={(i) =>
          setDraft((d) => ({ ...d, remotePhotoUrls: d.remotePhotoUrls.filter((_, j) => j !== i) }))
        }
      />

      <Text style={styles.section}>Personality</Text>
      <Input
        label={`Bio (${draft.bio.length}/150)`}
        multiline
        numberOfLines={4}
        maxLength={150}
        value={draft.bio}
        onChangeText={(t) => setDraft((d) => ({ ...d, bio: t }))}
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
      <Text style={[authSoftLabelStyle, styles.fieldSpace]}>Intent</Text>
      <View style={styles.chipRow}>
        {(['friendship', 'dating', 'activity', 'networking'] as MeetingIntent[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => setDraft((d) => ({ ...d, meetingIntent: k }))}
            style={[styles.chip, draft.meetingIntent === k && styles.chipOn]}
          >
            <Text style={[styles.chipTxt, draft.meetingIntent === k && styles.chipTxtOn]}>
              {k === 'friendship'
                ? 'Friendship'
                : k === 'dating'
                  ? 'Dating'
                  : k === 'activity'
                    ? 'Activity'
                    : 'Networking'}
            </Text>
          </Pressable>
        ))}
      </View>
      <PromptSelector answers={draft.promptAnswers} onChange={(next) => setDraft((d) => ({ ...d, promptAnswers: next }))} />

      <Text style={styles.section}>Preferences</Text>
      <Text style={[authSoftLabelStyle, styles.fieldSpace]}>I am</Text>
      <View style={styles.chipRow}>
        {['Woman', 'Man', 'Non-binary', 'Prefer not to say'].map((g) => (
          <Pressable
            key={g}
            onPress={() => setDraft((d) => ({ ...d, selfGender: g }))}
            style={[styles.chip, draft.selfGender === g && styles.chipOn]}
          >
            <Text style={[styles.chipTxt, draft.selfGender === g && styles.chipTxtOn]}>{g}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[authSoftLabelStyle, styles.fieldSpace]}>Show me</Text>
      <View style={styles.chipRow}>
        {(['everyone', 'women', 'men'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setDraft((d) => ({ ...d, showMe: k }))}
            style={[styles.chip, draft.showMe === k && styles.chipOn]}
          >
            <Text style={[styles.chipTxt, draft.showMe === k && styles.chipTxtOn]}>
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
        style={styles.slider}
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
      <Text style={styles.sliderLabel}>Distance: {Math.round(draft.radiusKm)} km</Text>
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
        <Text style={styles.switchLabel}>Profile visible</Text>
        <Switch
          value={draft.profilePublic}
          onValueChange={(v) => setDraft((d) => ({ ...d, profilePublic: v }))}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <Text style={styles.section}>Preview</Text>
      <ProfileCardPreview draft={draft} />

      <Pressable
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
        onPress={() => void save()}
        disabled={saving || !canSave}
        accessibilityRole="button"
        accessibilityLabel="Save profile"
      >
        <Text style={styles.saveBtnTxt}>{saving ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  section: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dateBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  dateTxt: { fontSize: 16, color: colors.text, fontWeight: '600' },
  fieldSpace: { marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  chipTxt: { fontSize: 14, fontWeight: '700', color: colors.text },
  chipTxtOn: { color: colors.primary },
  sliderLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  slider: { width: '100%', height: 44, marginBottom: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  saveBtn: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl * 2,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
