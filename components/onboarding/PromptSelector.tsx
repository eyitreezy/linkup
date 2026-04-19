import { authSoftLabelStyle, Input } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { HINGE_PROMPTS } from '@/lib/onboarding/constants';
import type { PromptAnswer } from '@/types/onboarding';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  answers: PromptAnswer[];
  onChange: (next: PromptAnswer[]) => void;
  maxPrompts?: number;
  /** Match onboarding form fields (`onboarding` = white + border on grey screens). */
  inputVariant?: 'soft' | 'onboarding';
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
        return (
          <View key={p.id} style={styles.block}>
            {!selected ? (
              showAdd ? (
                <Pressable style={styles.promptPick} onPress={() => addPrompt(p.id)}>
                  <Text style={styles.promptPickText}>+ {p.text}</Text>
                </Pressable>
              ) : null
            ) : (
              <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}>
                <View style={styles.promptCard}>
                  <View style={styles.promptHeader}>
                    <Text style={styles.promptTitle}>{p.text}</Text>
                    <Pressable onPress={() => remove(p.id)} hitSlop={8}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  </View>
                  <Input
                    placeholder="Your answer…"
                    value={selected.answer}
                    onChangeText={(t) => updateAnswer(p.id, t)}
                    multiline
                    numberOfLines={3}
                    variant={inputVariant}
                  />
                </View>
              </MotiView>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabelExtra: {
    marginBottom: onboarding.spacing.md,
  },
  block: { marginBottom: onboarding.spacing.sm },
  promptPick: {
    padding: onboarding.spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  promptPickText: { fontSize: 15, fontWeight: '600', color: onboarding.text },
  promptCard: {
    padding: onboarding.spacing.md,
    borderRadius: onboarding.radius2xl,
    backgroundColor: onboarding.cardBg,
    ...onboarding.shadow,
  },
  promptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  promptTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: onboarding.text },
  remove: { fontSize: 13, fontWeight: '600', color: onboarding.accent },
});
