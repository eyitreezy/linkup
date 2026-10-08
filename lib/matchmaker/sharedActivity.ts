export const SHARED_ACTIVITY_OTHER_LABEL = 'Other';

export const SHARED_ACTIVITY_OTHER_MAX_LENGTH = 100;

export type ActivityAnswerPayload =
  | string
  | { kind: 'other'; text: string }
  | { answer: unknown };

export function clampSharedActivityOtherInput(raw: string): string {
  return raw.slice(0, SHARED_ACTIVITY_OTHER_MAX_LENGTH);
}

export function normalizeActivityAnswerForSubmit(
  selected: string | null,
  otherText: string,
  isOther: boolean
): { ok: true; payload: ActivityAnswerPayload } | { ok: false; message: string } {
  if (!selected) {
    return { ok: false, message: 'Select an answer to continue.' };
  }
  if (isOther || selected === SHARED_ACTIVITY_OTHER_LABEL) {
    const trimmed = otherText.trim();
    if (!trimmed) {
      return { ok: false, message: 'Please enter your answer.' };
    }
    if (trimmed.length > SHARED_ACTIVITY_OTHER_MAX_LENGTH) {
      return { ok: false, message: 'Answer must be 100 characters or fewer.' };
    }
    return { ok: true, payload: { kind: 'other', text: clampSharedActivityOtherInput(trimmed) } };
  }
  return { ok: true, payload: selected };
}

/** Display text for a stored answer (preset string or other object). */
export function formatActivityAnswerDisplay(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (o.kind === 'other' && typeof o.text === 'string') return o.text;
    if (typeof o.answer === 'string') return o.answer;
    if (typeof o.text === 'string') return o.text;
  }
  return String(value);
}

export type SharedActivityRpcState = {
  activity_id: string | null;
  connection_id: string;
  week_number: number;
  questions: unknown;
  my_answer: unknown;
  partner_answer: unknown;
  partner_answer_concealed: boolean;
  mine_submitted_at: string | null;
  partner_submitted_at: string | null;
  revealed_at: string | null;
  partner_has_shared: boolean;
};

export function sharedActivityPhaseFromState(
  state: SharedActivityRpcState | null,
  isUserA: boolean
): 'question' | 'waiting' | 'reveal' {
  if (!state?.activity_id) return 'question';
  if (state.revealed_at) return 'reveal';
  if (state.mine_submitted_at) return 'waiting';
  return 'question';
}

export function restoreLocalSelectionFromMyAnswer(myAnswer: unknown): {
  selected: string | null;
  otherText: string;
  isOther: boolean;
} {
  if (myAnswer == null) return { selected: null, otherText: '', isOther: false };
  if (typeof myAnswer === 'string') {
    return { selected: myAnswer, otherText: '', isOther: false };
  }
  if (typeof myAnswer === 'object') {
    const o = myAnswer as Record<string, unknown>;
    if (o.kind === 'other' && typeof o.text === 'string') {
      return { selected: SHARED_ACTIVITY_OTHER_LABEL, otherText: o.text, isOther: true };
    }
  }
  return { selected: null, otherText: '', isOther: false };
}
