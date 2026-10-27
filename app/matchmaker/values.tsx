import { Button } from '@/components/Button';
import { authSoftLabelStyle, Input } from '@/components/Input';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { OnboardingStickyProgress } from '@/components/onboarding/OnboardingStickyProgress';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  PACE_PREFERENCE_OPTIONS,
  PACE_PREFERENCE_PRIVATE_LABEL,
  PACE_PREFERENCE_QUESTION,
  pacePreferenceDbFromUi,
  type PacePreferenceUiKey,
} from '@/lib/matchmaker/pacePreference';
import { normalizeDealbreakersForSave, sanitizeDigitsInput } from '@/lib/matchmaker/dealbreakersForm';
import {
  buildDealbreakersDbPayload,
  buildFaithDbValue,
  COMMUNICATION_STYLE_OPTIONS,
  EMPTY_DEALBREAKERS,
  loadMatchMakerValuesForm,
  VALUES_FOCUS_TO_STEP,
  type DealbreakersDraft,
  type MatchMakerValuesFormState,
  type ValuesFormFocus,
} from '@/lib/matchmaker/valuesForm';
import {
  exitMatchMakerSettingsEdit,
  isSettingsEditOrigin,
} from '@/lib/matchmaker/valuesNavigation';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VALUES_STEP_LABELS = ['Faith & religion', 'Family goals', 'Pace Preference', 'Dealbreakers'];

const FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: 'yes_want_children', label: 'Yes, I want children' },
  { value: 'open_to_it', label: 'Open to it' },
  { value: 'no_children', label: 'No, I do not want children' },
  { value: 'have_open_more', label: 'I have children and am open to more' },
  { value: 'have_not_open_more', label: 'I have children and I am not open to more' },
];

const FAITH_TYPES: { value: string; label: string }[] = [
  { value: 'Christianity', label: 'Christianity' },
  { value: 'Islam', label: 'Islam' },
  { value: 'other', label: 'Other faith' },
  { value: 'Prefer not to specify', label: 'Prefer not to specify' },
];

function applyLoadedFormState(
  loaded: MatchMakerValuesFormState,
  setters: {
    setFaith: (v: MatchMakerValuesFormState['faith']) => void;
    setFaithType: (v: string | null) => void;
    setOtherFaithText: (v: string) => void;
    setFamilyGoals: (v: string | null) => void;
    setPace: (v: PacePreferenceUiKey | null) => void;
    setLoadedPaceDb: (v: string | null) => void;
    setCommunicationStyle: (v: string | null) => void;
    setDealbreakers: (v: DealbreakersDraft) => void;
    setOtherDealbreakers: (v: string[]) => void;
  }
) {
  setters.setFaith(loaded.faith);
  setters.setFaithType(loaded.faithType);
  setters.setOtherFaithText(loaded.otherFaithText);
  setters.setFamilyGoals(loaded.familyGoals);
  setters.setPace(loaded.pace);
  setters.setLoadedPaceDb(loaded.paceDbRaw);
  setters.setCommunicationStyle(loaded.communicationStyle);
  setters.setDealbreakers(loaded.dealbreakers);
  setters.setOtherDealbreakers(loaded.otherDealbreakers);
}

export default function MatchMakerValuesScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const params = useLocalSearchParams<{ from?: string; focus?: string }>();
  const fromSettings = isSettingsEditOrigin(params.from);
  const focusParam = params.focus as ValuesFormFocus | undefined;

  const [step, setStep] = useState(0);
  const [faith, setFaith] = useState<'yes' | 'open' | 'skip' | null>(null);
  const [faithType, setFaithType] = useState<string | null>(null);
  const [otherFaithText, setOtherFaithText] = useState('');
  const [familyGoals, setFamilyGoals] = useState<string | null>(null);
  const [pace, setPace] = useState<PacePreferenceUiKey | null>(null);
  const [loadedPaceDb, setLoadedPaceDb] = useState<string | null>(null);
  const [communicationStyle, setCommunicationStyle] = useState<string | null>(null);
  const [otherDealbreakers, setOtherDealbreakers] = useState<string[]>([]);
  const [otherDbInput, setOtherDbInput] = useState('');
  const [dealbreakers, setDealbreakers] = useState<DealbreakersDraft>({ ...EMPTY_DEALBREAKERS });
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCommEditor, setShowCommEditor] = useState(false);

  const editingCommunicationOnly = fromSettings && focusParam === 'communication';

  const hydrate = useCallback(async () => {
    if (!user?.id) return;
    setLoadError(null);
    setHydrated(false);
    try {
      const loaded = await loadMatchMakerValuesForm(user.id);
      applyLoadedFormState(loaded, {
        setFaith,
        setFaithType,
        setOtherFaithText,
        setFamilyGoals,
        setPace,
        setLoadedPaceDb,
        setCommunicationStyle,
        setDealbreakers,
        setOtherDealbreakers,
      });
      if (fromSettings && focusParam && focusParam !== 'communication') {
        setStep(VALUES_FOCUS_TO_STEP[focusParam]);
      } else if (!fromSettings) {
        setStep(0);
      }
      setHydrated(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your MatchMaker values');
    }
  }, [user?.id, fromSettings, focusParam]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!fromSettings) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitMatchMakerSettingsEdit();
      return true;
    });
    return () => sub.remove();
  }, [fromSettings]);

  const stepValid = useMemo(() => {
    if (step === 0) {
      if (!faith) return false;
      if (faith === 'yes' && !faithType) return false;
      if (faith === 'yes' && faithType === 'other' && !otherFaithText.trim()) return false;
      return true;
    }
    if (step === 1) return familyGoals != null;
    if (step === 2) return pace != null;
    return true;
  }, [step, faith, faithType, otherFaithText, familyGoals, pace]);

  function addOtherDealbreakerTag() {
    const trimmed = otherDbInput.trim();
    if (!trimmed || otherDealbreakers.includes(trimmed) || otherDealbreakers.length >= 10) return;
    setOtherDealbreakers((prev) => [...prev, trimmed]);
    setOtherDbInput('');
  }

  async function saveAndEnter() {
    if (!user?.id || busy) return;
    if (editingCommunicationOnly && !communicationStyle) {
      Alert.alert('MatchMaker', 'Select a communication style to continue.');
      return;
    }
    setBusy(true);

    try {
      const paceDb = pacePreferenceDbFromUi(pace) ?? loadedPaceDb;
      if (!paceDb) {
        Alert.alert('MatchMaker', 'Select a pace preference to continue.');
        setBusy(false);
        return;
      }
      const faithValue = buildFaithDbValue(faith, faithType, otherFaithText);
      const dbDealbreakers = normalizeDealbreakersForSave(dealbreakers);
      const { error: valuesError } = await supabase.from('matchmaker_values').upsert({
        user_id: user.id,
        faith: faithValue,
        family_goals: familyGoals ?? 'open_to_it',
        pace_preference: paceDb,
        communication_frequency: communicationStyle,
        dealbreakers: buildDealbreakersDbPayload(dbDealbreakers, otherDealbreakers),
        updated_at: new Date().toISOString(),
      });
      if (valuesError) throw valuesError;

      if (communicationStyle) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ communication_style: communicationStyle })
          .eq('user_id', user.id);
        if (profileError) throw profileError;
        await refreshProfile();
      }

      if (fromSettings) {
        exitMatchMakerSettingsEdit();
      } else {
        router.replace('/matchmaker' as Href);
      }
    } catch (e) {
      Alert.alert('MatchMaker', e instanceof Error ? e.message : 'Could not save values');
    } finally {
      setBusy(false);
    }
  }

  function handleNext() {
    if (fromSettings || editingCommunicationOnly) {
      if (stepValid || editingCommunicationOnly) void saveAndEnter();
      return;
    }
    if (step < 3) {
      if (stepValid) setStep((s) => s + 1);
      return;
    }
    void saveAndEnter();
  }

  function handleTopBack() {
    if (fromSettings) {
      exitMatchMakerSettingsEdit();
      return;
    }
    if (step > 0) setStep((s) => s - 1);
  }

  const commStepValid = communicationStyle != null;

  const stepValidWithComm = useMemo(() => {
    if (editingCommunicationOnly) return commStepValid;
    if (step === 0 && !communicationStyle) return false;
    return stepValid;
  }, [editingCommunicationOnly, commStepValid, step, communicationStyle, stepValid]);

  if (loadError) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.loadErrorText}>{loadError}</Text>
        <Pressable onPress={() => void hydrate()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  if (editingCommunicationOnly) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={exitMatchMakerSettingsEdit}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back to MatchMaker Settings"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.editScreenTitle}>Communication style</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepCard}>
            <Text style={styles.heading}>How do you prefer to communicate?</Text>
            <Text style={styles.privateLabel}>This updates your LinkUp profile and MatchMaker preferences.</Text>
            <ChoiceChipRow>
              {COMMUNICATION_STYLE_OPTIONS.map(({ value, label }) => (
                <ChoiceChip
                  key={value}
                  label={label}
                  selected={communicationStyle === value}
                  onPress={() => setCommunicationStyle(value)}
                />
              ))}
            </ChoiceChipRow>
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Save changes"
            onPress={handleNext}
            loading={busy}
            disabled={!commStepValid}
            gradient
            pill
            fullWidth
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {step > 0 || fromSettings ? (
          <Pressable
            onPress={handleTopBack}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={{ flex: 1 }}>
          {fromSettings ? (
            <Text style={styles.editScreenTitle}>{VALUES_STEP_LABELS[step] ?? 'MatchMaker values'}</Text>
          ) : (
            <OnboardingStickyProgress step={step} total={4} stepLabels={VALUES_STEP_LABELS} />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepCard}>
          {step === 0 ? (
            <>
              {communicationStyle && !showCommEditor ? (
                <View style={styles.reviewCard}>
                  <View style={styles.reviewCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewKicker}>From your LinkUp profile</Text>
                      <Text style={styles.reviewVal}>
                        Communication style: {communicationStyle.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setShowCommEditor(true)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Edit communication style"
                    >
                      <Ionicons name="create-outline" size={20} color={MM.accent} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {(!communicationStyle || showCommEditor) ? (
                <>
                  <Text style={styles.heading}>How do you prefer to communicate?</Text>
                  <ChoiceChipRow>
                    {COMMUNICATION_STYLE_OPTIONS.map(({ value, label }) => (
                      <ChoiceChip
                        key={value}
                        label={label}
                        selected={communicationStyle === value}
                        onPress={() => setCommunicationStyle(value)}
                      />
                    ))}
                  </ChoiceChipRow>
                </>
              ) : null}
              <Text style={styles.heading}>Does faith matter to you in a relationship?</Text>
              <Text style={styles.privateLabel}>This is private and never shown to others.</Text>
              <ChoiceChipRow>
                <ChoiceChip
                  label="Yes, faith is important to me"
                  selected={faith === 'yes'}
                  onPress={() => {
                    setFaith('yes');
                    setFaithType(null);
                    setOtherFaithText('');
                  }}
                />
                <ChoiceChip
                  label="Open, faith is not a deciding factor for me"
                  selected={faith === 'open'}
                  onPress={() => {
                    setFaith('open');
                    setFaithType(null);
                    setOtherFaithText('');
                  }}
                />
                <ChoiceChip
                  label="Prefer not to say"
                  selected={faith === 'skip'}
                  onPress={() => {
                    setFaith('skip');
                    setFaithType(null);
                    setOtherFaithText('');
                  }}
                />
              </ChoiceChipRow>
              {faith === 'yes' ? (
                <ChoiceChipRow>
                  {FAITH_TYPES.map(({ value, label }) => (
                    <ChoiceChip
                      key={value}
                      label={label}
                      selected={faithType === value}
                      onPress={() => {
                        setFaithType(value);
                        if (value !== 'other') setOtherFaithText('');
                      }}
                    />
                  ))}
                </ChoiceChipRow>
              ) : null}
              {faithType === 'other' ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={authSoftLabelStyle}>Please specify your faith</Text>
                  <Input
                    value={otherFaithText}
                    onChangeText={(t) => setOtherFaithText(t.slice(0, 50))}
                    placeholder="e.g. Hinduism, Buddhism, Sikhism..."
                    maxLength={50}
                    variant="onboarding"
                    autoFocus
                    returnKeyType="done"
                  />
                  <Text style={styles.charCounter}>{otherFaithText.length}/50</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.heading}>What are your goals around children?</Text>
              <Text style={styles.privateLabel}>Private. Never shown publicly.</Text>
              <ChoiceChipRow>
                {FAMILY_OPTIONS.map(({ value, label }) => (
                  <ChoiceChip
                    key={value}
                    label={label}
                    selected={familyGoals === value}
                    onPress={() => setFamilyGoals(value)}
                  />
                ))}
              </ChoiceChipRow>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.heading}>{PACE_PREFERENCE_QUESTION}</Text>
              <Text style={styles.privateLabel}>{PACE_PREFERENCE_PRIVATE_LABEL}</Text>
              <ChoiceChipRow>
                {PACE_PREFERENCE_OPTIONS.map(({ key, label }) => (
                  <ChoiceChip
                    key={key}
                    label={label}
                    selected={pace === key}
                    onPress={() => setPace(key)}
                  />
                ))}
              </ChoiceChipRow>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.heading}>Are there absolute dealbreakers for you?</Text>
              <Text style={styles.privateLabel}>
                These are private hard filters. Profiles that do not meet them are silently excluded
                before you see them. They are never disclosed to anyone.
              </Text>
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Faith alignment must match</Text>
                <Switch
                  value={dealbreakers.faith}
                  onValueChange={(v) => setDealbreakers((d) => ({ ...d, faith: v }))}
                  trackColor={{ false: '#E8E4F5', true: colors.primary }}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Family goals must align</Text>
                <Switch
                  value={dealbreakers.family}
                  onValueChange={(v) => setDealbreakers((d) => ({ ...d, family: v }))}
                  trackColor={{ false: '#E8E4F5', true: colors.primary }}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Must be within distance range</Text>
                <Switch
                  value={dealbreakers.location}
                  onValueChange={(v) => setDealbreakers((d) => ({ ...d, location: v }))}
                  trackColor={{ false: '#E8E4F5', true: colors.primary }}
                />
              </View>
              {dealbreakers.location ? (
                <View style={styles.dealbreakerField}>
                  <Text style={authSoftLabelStyle}>Maximum distance (km)</Text>
                  <Input
                    value={String(dealbreakers.locationKm)}
                    onChangeText={(t) =>
                      setDealbreakers((d) => ({
                        ...d,
                        locationKm: Number(sanitizeDigitsInput(t, 3)) || d.locationKm,
                      }))
                    }
                    keyboardType="number-pad"
                    variant="onboarding"
                    maxLength={3}
                  />
                </View>
              ) : null}
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Must be within age range</Text>
                <Switch
                  value={dealbreakers.age}
                  onValueChange={(v) => setDealbreakers((d) => ({ ...d, age: v }))}
                  trackColor={{ false: '#E8E4F5', true: colors.primary }}
                />
              </View>
              {dealbreakers.age ? (
                <View style={styles.dealbreakerAgeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={authSoftLabelStyle}>Min age</Text>
                    <Input
                      value={String(dealbreakers.ageMin)}
                      onChangeText={(t) =>
                        setDealbreakers((d) => ({
                          ...d,
                          ageMin: Number(sanitizeDigitsInput(t, 2)) || d.ageMin,
                        }))
                      }
                      keyboardType="number-pad"
                      variant="onboarding"
                      maxLength={2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={authSoftLabelStyle}>Max age</Text>
                    <Input
                      value={String(dealbreakers.ageMax)}
                      onChangeText={(t) =>
                        setDealbreakers((d) => ({
                          ...d,
                          ageMax: Number(sanitizeDigitsInput(t, 2)) || d.ageMax,
                        }))
                      }
                      keyboardType="number-pad"
                      variant="onboarding"
                      maxLength={2}
                    />
                  </View>
                </View>
              ) : null}
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Other dealbreakers</Text>
                  <Text style={styles.switchHint}>Add your own specific requirements</Text>
                </View>
                <Switch
                  value={dealbreakers.other}
                  onValueChange={(v) => setDealbreakers((d) => ({ ...d, other: v }))}
                  trackColor={{ false: '#E8E4F5', true: colors.primary }}
                />
              </View>
              {dealbreakers.other ? (
                <View style={styles.otherDbContainer}>
                  <Text style={styles.otherDbHeading}>Your dealbreakers</Text>
                  <Text style={styles.otherDbSub}>
                    Add specific requirements that matter to you. Max 10.
                  </Text>

                  {otherDealbreakers.length > 0 ? (
                    <View style={styles.tagRow}>
                      {otherDealbreakers.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                          <Pressable
                            onPress={() =>
                              setOtherDealbreakers((prev) => prev.filter((t) => t !== tag))
                            }
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${tag}`}
                            style={({ pressed }) => [styles.tagRemove, pressed && { opacity: 0.7 }]}
                          >
                            <Ionicons name="close" size={12} color={colors.textMuted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {otherDealbreakers.length < 10 ? (
                    <View style={styles.otherDbInputRow}>
                      <View style={{ flex: 1 }}>
                        <Input
                          value={otherDbInput}
                          onChangeText={(t) => setOtherDbInput(t.slice(0, 60))}
                          placeholder="e.g. Must not smoke"
                          maxLength={60}
                          variant="onboarding"
                          returnKeyType="done"
                          onSubmitEditing={addOtherDealbreakerTag}
                        />
                        <Text style={styles.charCounter}>{otherDbInput.length}/60</Text>
                      </View>
                      <Pressable
                        onPress={addOtherDealbreakerTag}
                        disabled={
                          !otherDbInput.trim() ||
                          otherDealbreakers.includes(otherDbInput.trim())
                        }
                        style={({ pressed }) => [
                          styles.addBtn,
                          pressed && { opacity: 0.88 },
                          (!otherDbInput.trim() ||
                            otherDealbreakers.includes(otherDbInput.trim())) && { opacity: 0.4 },
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.addBtnText}>Add</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.otherDbMaxNote}>Maximum of 10 dealbreakers reached.</Text>
                  )}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={
            fromSettings ? 'Save changes' : step < 3 ? 'Continue' : 'Save and enter MatchMaker'
          }
          onPress={handleNext}
          loading={busy}
          disabled={!stepValidWithComm}
          gradient
          pill
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  loadErrorText: {
    fontFamily: fonts.medium,
    color: MM.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: MM.border,
  },
  retryText: { fontFamily: fonts.bold, color: MM.accent },
  editScreenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fonts.bold,
    color: MM.text,
    paddingTop: 6,
    paddingRight: 40,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: MM.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(237, 224, 212, 0.6)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },
  backBtn: { width: 40, paddingTop: 4, alignItems: 'center' },
  stepCard: {
    backgroundColor: onboarding.cardBg,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: onboarding.glassBorder,
    ...onboarding.shadow,
  },
  heading: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: MM.text,
    marginBottom: spacing.sm,
    lineHeight: 28,
  },
  privateLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  reviewCard: {
    backgroundColor: MM.surfaceWarm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  reviewKicker: { fontSize: 12, color: MM.muted, fontFamily: fonts.regular },
  reviewVal: { marginTop: 4, fontSize: 14, fontFamily: fonts.bold, color: MM.text },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.sm,
  },
  switchHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
  charCounter: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  otherDbContainer: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    backgroundColor: MM.surfaceWarm,
    padding: spacing.md,
  },
  otherDbHeading: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  otherDbSub: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: MM.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  tagRemove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(107,114,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherDbInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  addBtn: {
    marginTop: 2,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  otherDbMaxNote: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  dealbreakerField: { marginBottom: spacing.lg, marginTop: -spacing.sm },
  dealbreakerAgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
});
