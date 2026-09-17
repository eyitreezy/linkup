import { MM, MM_CTA_GRADIENT, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUESTIONS = [
  'After this connection, how do you feel about the pace at which you communicated?',
  'Did your expectations around family goals change or become clearer?',
  'What quality mattered most to you in this connection?',
  'Was there anything you wish you had known about this person earlier?',
  'What do you want to feel differently in your next connection?',
];

export default function MatchMakerHealScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(''));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: MM.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <Text style={styles.title}>A moment to refine.</Text>
      <Text style={styles.body}>Before you return to MatchMaker, take a moment to update what matters to you.</Text>
      <Text style={styles.q}>{QUESTIONS[step]}</Text>
      <TextInput
        value={answers[step]}
        onChangeText={(t) => setAnswers((prev) => prev.map((v, i) => (i === step ? t : v)))}
        multiline
        style={styles.input}
        placeholder="Your answer"
        placeholderTextColor={MM.muted}
      />
      <Pressable
        onPress={() => {
          if (step < QUESTIONS.length - 1) setStep((s) => s + 1);
          else router.replace('/matchmaker/reentry' as Href);
        }}
        style={{ marginTop: spacing.lg }}
      >
        <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
          <Text style={styles.ctaText}>{step < QUESTIONS.length - 1 ? 'Next' : 'Save and finish'}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={() => setStep((s) => Math.min(s + 1, QUESTIONS.length - 1))} style={{ marginTop: spacing.md, alignSelf: 'center' }}>
        <Text style={styles.skip}>Skip this question</Text>
      </Pressable>
      <Text style={styles.progress}>Healing period · Question {step + 1} of {QUESTIONS.length}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  skip: { color: MM.muted, fontFamily: fonts.regular },
  progress: { marginTop: spacing.lg, textAlign: 'center', color: MM.muted, fontFamily: fonts.regular },
});
