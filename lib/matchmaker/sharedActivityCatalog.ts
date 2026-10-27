export type SharedActivityWeekDefinition = {
  weekNumber: number;
  questionNumber: number;
  question: string;
  presets: readonly string[];
};

/** Finite weekly catalog (spec: one question per week). */
export const SHARED_ACTIVITY_CATALOG: readonly SharedActivityWeekDefinition[] = [
  {
    weekNumber: 1,
    questionNumber: 1,
    question: 'What does your ideal Sunday look like?',
    presets: [
      'Relaxing at home with a good book',
      'Exploring somewhere new outdoors',
      'Church or community time',
      'Food, friends, and good conversation',
    ],
  },
  {
    weekNumber: 2,
    questionNumber: 1,
    question: 'What helps you feel most connected in a conversation?',
    presets: [
      'Thoughtful questions and real listening',
      'Shared laughter and light moments',
      'Talking about values and future hopes',
      'Quality time without distractions',
    ],
  },
  {
    weekNumber: 3,
    questionNumber: 1,
    question: 'How do you like to recharge after a busy week?',
    presets: [
      'Quiet time alone',
      'Time with close friends or family',
      'Faith or community activities',
      'Something active or outdoors',
    ],
  },
  {
    weekNumber: 4,
    questionNumber: 1,
    question: 'What does building trust look like to you over time?',
    presets: [
      'Consistency in words and actions',
      'Open and honest communication',
      'Respecting boundaries and pace',
      'Showing up when it matters',
    ],
  },
  {
    weekNumber: 5,
    questionNumber: 1,
    question: 'What role does family play in your life right now?',
    presets: [
      'Very close and involved',
      'Supportive but independent',
      'Still figuring out my path',
      'Family is chosen community too',
    ],
  },
  {
    weekNumber: 6,
    questionNumber: 1,
    question: 'What kind of pace feels right when getting to know someone?',
    presets: [
      'Slow and intentional',
      'Steady with room to breathe',
      'Flexible depending on chemistry',
      'Clear milestones help me feel secure',
    ],
  },
  {
    weekNumber: 7,
    questionNumber: 1,
    question: 'What is one habit you are proud of in how you treat people?',
    presets: [
      'I follow through on what I say',
      'I stay calm during disagreements',
      'I make time for people I care about',
      'I try to lead with empathy',
    ],
  },
  {
    weekNumber: 8,
    questionNumber: 1,
    question: 'What would a meaningful first in-person meetup look like for you?',
    presets: [
      'Coffee or tea in a calm setting',
      'A walk somewhere scenic',
      'A shared activity we both enjoy',
      'Something simple with no pressure',
    ],
  },
] as const;

export const SHARED_ACTIVITY_MAX_WEEKS = SHARED_ACTIVITY_CATALOG.length;

export function sharedActivityWeekDefinition(weekNumber: number): SharedActivityWeekDefinition | null {
  return SHARED_ACTIVITY_CATALOG.find((w) => w.weekNumber === weekNumber) ?? null;
}
