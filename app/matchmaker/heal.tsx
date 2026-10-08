import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { MM, MM_CTA_GRADIENT, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import {
  fetchMatchMakerGateState,
  gateRouteFor,
  saveHealingAnswers,
} from '@/lib/matchmaker/gates';
import {
  HEALING_Q1_OPTIONS,
  HEALING_Q2_OPTIONS,
  HEALING_QUESTIONS,
  buildHealingAnswersPayload,
  type HealingAnswersDraft,
} from '@/lib/matchmaker/healingQuestions';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TEXT_STEPS = [2, 3, 4] as const;

export default function MatchMakerHealScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [healingDay, setHealingDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<HealingAnswersDraft>({
    communication_pace: null,
    family_goals_clarity: null,
    quality_mattered: '',
    wish_known: '',
    want_differently: '',
  });

  const syncGate = useCallback(async () => {
    setLoading(true);
    try {
      const state = await fetchMatchMakerGateState();
      if (state.gate !== 'healing') {
        const redirect = gateRouteFor(state);
        if (redirect) router.replace(redirect as Href);
        else router.replace('/matchmaker' as Href);
        return;
      }
      setHealingDay(state.healingDay ?? 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void syncGate();
    }, [syncGate])
  );

  const onFinalPage = step >= HEALING_QUESTIONS.length;

  async function goNext(skip: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (onFinalPage) {
        await saveHealingAnswers(buildHealingAnswersPayload(draft), { complete: true });
        router.replace('/matchmaker/reentry' as Href);
        return;
      }
      await saveHealingAnswers(buildHealingAnswersPayload(draft), { complete: false, skipAll: skip });
      setStep((s) => s + 1);
    } finally {
      setBusy(false);
    }
  }

  async function skipAll() {
    if (busy) return;
    setBusy(true);
    try {
      await saveHealingAnswers(buildHealingAnswersPayload(draft), { skipAll: true, complete: true });
      router.replace('/matchmaker/reentry' as Href);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
      }}
    >
      <Text style={styles.title}>A moment to refine.</Text>
      <Text style={styles.body}>
        Before you return to MatchMaker, take a moment to update what matters to you.
      </Text>

      {!onFinalPage ? (
        <>
          <Text style={styles.q}>{HEALING_QUESTIONS[step]}</Text>
          {step === 0 ? (
            <ChoiceChipRow style={{ marginTop: spacing.md }}>
              {HEALING_Q1_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.value}
                  label={opt.label}
                  selected={draft.communication_pace === opt.value}
                  onPress={() => setDraft((d) => ({ ...d, communication_pace: opt.value }))}
                />
              ))}
            </ChoiceChipRow>
          ) : null}
          {step === 1 ? (
            <ChoiceChipRow style={{ marginTop: spacing.md }}>
              {HEALING_Q2_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.value}
                  label={opt.label}
                  selected={draft.family_goals_clarity === opt.value}
                  onPress={() => setDraft((d) => ({ ...d, family_goals_clarity: opt.value }))}
                />
              ))}
            </ChoiceChipRow>
          ) : null}
          {TEXT_STEPS.includes(step as (typeof TEXT_STEPS)[number]) ? (
            <TextInput
              value={
                step === 2
                  ? draft.quality_mattered
                  : step === 3
                    ? draft.wish_known
                    : draft.want_differently
              }
              onChangeText={(t) => {
                if (step === 2) setDraft((d) => ({ ...d, quality_mattered: t }));
                else if (step === 3) setDraft((d) => ({ ...d, wish_known: t }));
                else setDraft((d) => ({ ...d, want_differently: t }));
              }}
              multiline
              style={styles.input}
              placeholder="Your answer"
              placeholderTextColor={MM.muted}
            />
          ) : null}
          <Pressable disabled={busy} onPress={() => void goNext(false)} style={{ marginTop: spacing.lg }}>
            <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
              <Text style={styles.ctaText}>Next</Text>
            </LinearGradient>
          </Pressable>
          <Pressable disabled={busy} onPress={() => void goNext(true)} style={styles.skipWrap}>
            <Text style={styles.skip}>Skip this question</Text>
          </Pressable>
          <Text style={styles.progress}>
            Healing period · Day {healingDay} of 3 · Question {step + 1} of {HEALING_QUESTIONS.length}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.q}>Want to update any dealbreakers or values?</Text>
          <Pressable
            onPress={() => router.push('/matchmaker/values' as Href)}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>Update values and dealbreakers</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => void goNext(false)} style={{ marginTop: spacing.lg }}>
            <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
              <Text style={styles.ctaText}>Save and finish</Text>
            </LinearGradient>
          </Pressable>
          <Pressable disabled={busy} onPress={() => void skipAll()} style={styles.skipWrap}>
            <Text style={styles.skip}>Skip all, I will update later</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: MM.bg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: fonts.bold, color: MM.text },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
  q: { marginTop: spacing.lg, fontFamily: fonts.bold, color: MM.text, lineHeight: 22 },
  input: {
    marginTop: spacing.md,
    minHeight: 120,
    borderWidth: 1,
    borderColor: MM.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: MM.surface,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    color: MM.text,
  },
  cta: { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold },
  skipWrap: { marginTop: spacing.md, alignSelf: 'center' },
  skip: { color: MM.muted, fontFamily: fonts.regular },
  progress: { marginTop: spacing.lg, textAlign: 'center', color: MM.muted, fontFamily: fonts.regular },
  outlineBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  outlineBtnText: { fontFamily: fonts.medium, color: MM.text },
});
