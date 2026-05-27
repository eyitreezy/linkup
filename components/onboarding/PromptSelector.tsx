import { authSoftLabelStyle, Input } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { HINGE_PROMPTS } from '@/lib/onboarding/constants';
import type { PromptAnswer } from '@/types/onboarding';
import { MotiView } from 'moti';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  answers: PromptAnswer[];
  onChange: (next: PromptAnswer[]) => void;
  maxPrompts?: number;
  /** Multiline field chrome — match profile / edit screens (`onboardingFlat`) or legacy onboarding. */
  inputVariant?: 'soft' | 'onboarding' | 'onboardingFlat';
};

export function PromptSelector({ answers, onChange, maxPrompts = 2, inputVariant = 'onboarding' }: Props) {
  const usedIds = new Set(answers.map((a) => a.promptId));
  const canAdd = answers.length < maxPrompts;

  function addPrompt(promptId: string) {
    const p = HINGE_PROMPTS.find((x) => x.id === promptId);
    if (!p || usedIds.has(promptId)) return;
    onChange([...answers, { promptId: p.id, prompt: p.text, answer: '' }]);
  }

  function updateAnswer(id: string, text: string) {
    onChange(answers.map((a) => (a.promptId === id ? { ...a, answer: text } : a)));
  }

  function remove(id: string) {
    onChange(answers.filter((a) => a.promptId !== id));
  }

  return (
    <View>
      <Text style={[authSoftLabelStyle, styles.sectionLabelExtra]}>
        Prompts (answer at least 1, up to {maxPrompts})
      </Text>
      {HINGE_PROMPTS.map((p) => {
        const selected = answers.find((a) => a.promptId === p.id);
        const showAdd = !selected && canAdd;
        if (!selected && !showAdd) return <Fragment key={p.id} />;

        if (showAdd) {
          return (
            <View key={p.id} style={styles.pickRow}>
              <Pressable style={styles.promptPick} onPress={() => addPrompt(p.id)}>
                <Text style={styles.promptPickText}>+ {p.text}</Text>
              </Pressable>
            </View>
          );
        }

        return (
          <MotiView key={p.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}>
            <View style={styles.promptAnswerBlock}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptTitle} numberOfLines={4}>
                  {p.text}
                </Text>
                <Pressable
                  onPress={() => remove(p.id)}
                  hitSlop={12}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this prompt"
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
              <Input
                placeholder="Your answer…"
                value={selected!.answer}
                onChangeText={(t) => updateAnswer(p.id, t)}
                multiline
                numberOfLines={4}
                variant={inputVariant}
              />
            </View>
          </MotiView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabelExtra: {
    marginBottom: onboarding.spacing.lg,
  },
  pickRow: { marginBottom: onboarding.spacing.sm },
  promptPick: {
    paddingVertical: onboarding.spacing.md,
    paddingHorizontal: onboarding.spacing.xs,
    marginHorizontal: -onboarding.spacing.xs,
    borderRadius: radius.button,
  },
  promptPickText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  promptAnswerBlock: {
    marginBottom: onboarding.spacing.lg,
    paddingBottom: onboarding.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.1)',
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: onboarding.spacing.md,
    marginBottom: onboarding.spacing.md,
  },
  promptTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    color: onboarding.text,
    letterSpacing: -0.2,
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.button,
    flexShrink: 0,
    marginTop: 2,
  },
  removeBtnPressed: { opacity: 0.75, backgroundColor: 'rgba(22, 163, 74, 0.1)' },
  remove: { fontSize: 14, fontWeight: '700', color: onboarding.accent },
});
