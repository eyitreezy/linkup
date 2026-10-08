export const HEALING_Q1_OPTIONS = [
  { value: 'too_fast', label: 'It felt too fast' },
  { value: 'about_right', label: 'It felt about right' },
  { value: 'too_slow', label: 'It felt too slow' },
  { value: 'varied', label: 'It varied' },
] as const;

export const HEALING_Q2_OPTIONS = [
  { value: 'clearer', label: 'They are clearer now' },
  { value: 'changed', label: 'They changed' },
  { value: 'same', label: 'They are still the same' },
  { value: 'unsure', label: 'I am still figuring it out' },
] as const;

export const HEALING_QUESTIONS = [
  'After this connection, how do you feel about the pace at which you communicated?',
  'Did your expectations around family goals change or become clearer?',
  'What quality mattered most to you in this connection?',
  'Was there anything you wish you had known about this person earlier?',
  'What do you want to feel differently in your next connection?',
] as const;

export type HealingAnswersDraft = {
  communication_pace: string | null;
  family_goals_clarity: string | null;
  quality_mattered: string;
  wish_known: string;
  want_differently: string;
};

export function buildHealingAnswersPayload(draft: HealingAnswersDraft): Record<string, unknown> {
  return {
    communication_pace: draft.communication_pace,
    family_goals_clarity: draft.family_goals_clarity,
    quality_mattered: draft.quality_mattered.trim() || null,
    wish_known: draft.wish_known.trim() || null,
    want_differently: draft.want_differently.trim() || null,
  };
}
