import { MM, MM_CTA_GRADIENT, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FAMILY_GOALS = [
  'yes_want_children',
  'open_to_it',
  'no_children',
  'have_open_more',
  'have_not_open_more',
] as const;

const PACE = ['platform_minimum', 'one_two_months', 'three_six_months', 'six_plus_months'] as const;

export default function MatchMakerValuesScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [faith, setFaith] = useState<string>('open');
  const [familyGoals, setFamilyGoals] = useState<string>(FAMILY_GOALS[1]);
  const [pace, setPace] = useState<string>(PACE[0]);
  const [busy, setBusy] = useState(false);

  const commReview = profile?.communication_style;

  const stepTitle = useMemo(
    () => ['Faith & religion', 'Family goals', 'Pace preference', 'Dealbreakers'][step],
    [step]
  );

  async function saveAndEnter() {
    if (!user?.id || busy) return;
    setBusy(true);
    await supabase.from('matchmaker_values').upsert({
      user_id: user.id,
      faith: faith === 'open' ? null : faith,
      family_goals: familyGoals,
      pace_preference: pace,
      communication_frequency: commReview ?? null,
      dealbreakers: {},
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    router.replace('/matchmaker/pool' as Href);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.lg }}
    >
      <Text style={styles.progress}>Step {step + 1} of 4</Text>
      <Text style={styles.title}>{stepTitle}</Text>
      {step === 0 && commReview ? (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewKicker}>From your LinkUp profile</Text>
          <Text style={styles.reviewVal}>Communication style: {commReview.replace(/_/g, ' ')}</Text>
        </View>
      ) : null}
      {step === 0 ? (
        ['yes_faith', 'open', 'prefer_not'].map((v) => (
          <Option key={v} label={v.replace(/_/g, ' ')} selected={faith === v} onPress={() => setFaith(v)} />
        ))
      ) : null}
      {step === 1 ? (
        FAMILY_GOALS.map((v) => (
          <Option key={v} label={v.replace(/_/g, ' ')} selected={familyGoals === v} onPress={() => setFamilyGoals(v)} />
        ))
      ) : null}
      {step === 2 ? (
        PACE.map((v) => (
          <Option key={v} label={v.replace(/_/g, ' ')} selected={pace === v} onPress={() => setPace(v)} />
        ))
      ) : null}
      {step === 3 ? (
        <Text style={styles.hint}>Dealbreakers can be updated later in MatchMaker settings.</Text>
      ) : null}
      <Pressable
        onPress={() => {
          if (step < 3) setStep((s) => s + 1);
          else void saveAndEnter();
        }}
        style={{ marginTop: spacing.xl }}
      >
        <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
          <Text style={styles.ctaText}>{step < 3 ? 'Continue' : busy ? 'Saving…' : 'Save and enter MatchMaker'}</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progress: { color: MM.muted, fontFamily: fonts.regular, marginBottom: spacing.sm },
  title: { fontSize: 22, fontFamily: fonts.bold, color: MM.text, marginBottom: spacing.lg },
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
  option: {
    borderWidth: 1.5,
    borderColor: MM.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: MM.surface,
  },
  optionSelected: { borderColor: MM.primary, backgroundColor: '#EEEDFF' },
  optionText: { fontFamily: fonts.medium, color: MM.text, textTransform: 'capitalize' },
  optionTextSelected: { fontFamily: fonts.bold, color: MM.primary },
  hint: { fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
  cta: { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold },
});
