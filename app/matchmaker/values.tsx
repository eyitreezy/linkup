import { Button } from '@/components/Button';
import { authSoftLabelStyle, Input } from '@/components/Input';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { OnboardingStickyProgress } from '@/components/onboarding/OnboardingStickyProgress';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VALUES_STEP_LABELS = ['Faith & religion', 'Family goals', 'Pace preference', 'Dealbreakers'];

const FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: 'yes_want_children', label: 'Yes, I want children' },
  { value: 'open_to_it', label: 'Open to it' },
  { value: 'no_children', label: 'No, I do not want children' },
  { value: 'have_open_more', label: 'I have children and am open to more' },
  { value: 'have_not_open_more', label: 'I have children and I am not open to more' },
];

const PACE_OPTIONS: { value: string; label: string }[] = [
  { value: 'platform_minimum', label: 'As soon as the platform allows (21 days minimum)' },
  { value: 'one_two_months', label: '1 to 2 months' },
  { value: 'three_six_months', label: '3 to 6 months' },
  { value: 'six_plus_months', label: 'I take my time, 6 months or more' },
];

const FAITH_TYPES: { value: string; label: string }[] = [
  { value: 'Christianity', label: 'Christianity' },
  { value: 'Islam', label: 'Islam' },
  { value: 'other', label: 'Other faith' },
  { value: 'Prefer not to specify', label: 'Prefer not to specify' },
];

type DealbreakersDraft = {
  faith: boolean;
  family: boolean;
  location: boolean;
  locationKm: number;
  age: boolean;
  ageMin: number;
  ageMax: number;
  other: boolean;
};

export default function MatchMakerValuesScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [faith, setFaith] = useState<'yes' | 'open' | 'skip' | null>(null);
  const [faithType, setFaithType] = useState<string | null>(null);
  const [otherFaithText, setOtherFaithText] = useState('');
  const [familyGoals, setFamilyGoals] = useState<string | null>(null);
  const [pace, setPace] = useState<string | null>(null);
  const [otherDealbreakers, setOtherDealbreakers] = useState<string[]>([]);
  const [otherDbInput, setOtherDbInput] = useState('');
  const [dealbreakers, setDealbreakers] = useState<DealbreakersDraft>({
    faith: false,
    family: false,
    location: false,
    locationKm: 25,
    age: false,
    ageMin: 22,
    ageMax: 40,
    other: false,
  });
  const [busy, setBusy] = useState(false);

  const commReview = profile?.communication_style;

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
    setBusy(true);

    let faithValue: string | null = null;
    if (faith === 'yes' && faithType) {
      faithValue = faithType === 'other' ? `other:${otherFaithText.trim()}` : faithType;
    } else if (faith === 'skip') {
      faithValue = 'prefer_not_to_say';
    }

    await supabase.from('matchmaker_values').upsert({
      user_id: user.id,
      faith: faithValue,
      family_goals: familyGoals ?? 'open_to_it',
      pace_preference: pace ?? 'platform_minimum',
      communication_frequency: commReview ?? null,
      dealbreakers: {
        faith_alignment: dealbreakers.faith,
        family_goals_align: dealbreakers.family,
        within_distance: dealbreakers.location,
        within_age_range: dealbreakers.age,
        other: dealbreakers.other ? otherDealbreakers : [],
      },
      updated_at: new Date().toISOString(),
    });

    setBusy(false);
    router.replace('/matchmaker' as Href);
  }

  function handleNext() {
    if (step < 3) {
      if (stepValid) setStep((s) => s + 1);
      return;
    }
    void saveAndEnter();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep((s) => s - 1)}
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
          <OnboardingStickyProgress step={step} total={4} stepLabels={VALUES_STEP_LABELS} />
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
              {commReview ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewKicker}>From your LinkUp profile</Text>
                  <Text style={styles.reviewVal}>
                    Communication style: {commReview.replace(/_/g, ' ')}
                  </Text>
                </View>
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
              <Text style={styles.heading}>How long after connecting do you expect to meet?</Text>
              <ChoiceChipRow>
                {PACE_OPTIONS.map(({ value, label }) => (
                  <ChoiceChip
                    key={value}
                    label={label}
                    selected={pace === value}
                    onPress={() => setPace(value)}
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
              <View style={styles.rowBetween}>
                <Text style={styles.switchLabel}>Must be within age range</Text>
                <Switch
                  value={dealbreakers.age}
                  onValueChange={(v) => setDealbreakers((d) => ({ ...d, age: v }))}
                  trackColor={{ false: '#E8E4F5', true: colors.primary }}
                />
              </View>
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
          title={step < 3 ? 'Continue' : 'Save and enter MatchMaker'}
          onPress={handleNext}
          loading={busy}
          disabled={step < 3 && !stepValid}
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
});
