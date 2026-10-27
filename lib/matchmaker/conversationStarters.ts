import type { ProfilePreferences } from '@/types/database';

export const CONVERSATION_STARTER_CATEGORY_ORDER = [
  'easy_icebreakers',
  'shared_interests',
  'playful_flirty',
  'get_to_know_you',
  'everyday_fun',
  'dating_intentions',
  'first_date_ideas',
  'thoughtful_meaningful',
] as const;

export type ConversationStarterCategoryId = (typeof CONVERSATION_STARTER_CATEGORY_ORDER)[number];

export type ConversationStarterCategory = {
  id: ConversationStarterCategoryId;
  label: string;
};

export const CONVERSATION_STARTER_CATEGORIES: readonly ConversationStarterCategory[] = [
  { id: 'easy_icebreakers', label: 'Easy Icebreakers' },
  { id: 'shared_interests', label: 'Based on Shared Interests' },
  { id: 'playful_flirty', label: 'Playful and Flirty' },
  { id: 'get_to_know_you', label: 'Get to Know You' },
  { id: 'everyday_fun', label: 'Everyday Fun' },
  { id: 'dating_intentions', label: 'Dating Intentions and Compatibility' },
  { id: 'first_date_ideas', label: 'First Date Ideas' },
  { id: 'thoughtful_meaningful', label: 'Thoughtful and Meaningful' },
];

const LIBRARY: Record<ConversationStarterCategoryId, readonly string[]> = {
  easy_icebreakers: [
    "What's something that made you smile today?",
    "What's your ideal way to spend a free afternoon?",
    'Are you more of a spontaneous-plan person or a plan-everything person?',
    "What's one little thing that can instantly improve your day?",
    'If you had a completely free Saturday, how would you spend it?',
  ],
  shared_interests: [
    'We seem to have something in common. How did you first get into it?',
    "I noticed we both enjoy this. What's your favourite part of it?",
    'If we had a free day to explore this interest, what would you want to do?',
    "What's something about this hobby that you think more people should try?",
    "What's one recommendation you'd give someone who wants to get into this?",
  ],
  playful_flirty: [
    "I was going to play it cool, but I'm genuinely curious about you. What's something I should know?",
    'Quick question: are you always this interesting, or am I getting the special introduction?',
    "What's your idea of a date that would be hard to forget?",
    'Be honest, who is more likely to suggest the first adventure, you or me?',
    'I get to ask one fun question first. What should it be?',
  ],
  get_to_know_you: [
    "What's something you're really looking forward to this year?",
    "What's a skill you'd love to learn if you had the time?",
    'What kind of people do you feel most comfortable around?',
    "What's a small thing that tells you a lot about someone?",
    "What's something you're proud of that people don't usually notice?",
  ],
  everyday_fun: [
    "What's a food you could happily eat every week?",
    "What's your current favourite song or artist?",
    'Would you choose a relaxed evening out or an adventure somewhere new?',
    "What's a movie or series you can watch more than once?",
    "What's one place you'd love to visit someday?",
  ],
  dating_intentions: [
    'What makes getting to know someone feel natural for you?',
    "Do you prefer chatting for a while first or meeting once you're comfortable?",
    "What's something you appreciate when someone is getting to know you?",
    'What does quality time look like for you?',
    "What's one thing that helps you feel comfortable around a new person?",
  ],
  first_date_ideas: [
    "What's your idea of a really good first date?",
    'Would you rather meet for coffee, food, or an activity?',
    "What's a place you think makes getting to know someone easier?",
    'If we planned something simple and fun, what would you suggest?',
    "What's one activity you've always wanted to try with someone?",
  ],
  thoughtful_meaningful: [
    "What's an experience that changed the way you see things?",
    'What does a genuinely good day look like to you?',
    "What's something you value more now than you did a few years ago?",
    'What helps you feel understood by another person?',
    "What's a lesson you've learned that you carry with you?",
  ],
};

export const QUICK_PICK_DISPLAY_COUNT = 5;

export function sharedPublicInterests(
  viewerPrefs: ProfilePreferences | null | undefined,
  peerPrefs: ProfilePreferences | null | undefined
): string[] {
  const viewerSet = new Set(viewerPrefs?.interests ?? []);
  return (peerPrefs?.interests ?? []).filter((tag) => viewerSet.has(tag));
}

/** Replace generic phrasing when a real shared interest label is known. */
export function applySharedInterestWording(starter: string, interestLabel: string | null): string {
  if (!interestLabel?.trim()) return starter;
  const label = interestLabel.trim();
  return starter
    .replace(/\bthis interest\b/gi, label)
    .replace(/\bthis hobby\b/gi, label)
    .replace(/\bboth enjoy this\b/gi, `both enjoy ${label}`)
    .replace(/\bsomething in common\. How/gi, `something in common with ${label}. How`)
    .replace(/\bget into this\b/gi, `get into ${label}`)
    .replace(/\bexplore this interest\b/gi, `explore ${label}`);
}

export function startersForCategory(
  categoryId: ConversationStarterCategoryId,
  sharedInterest: string | null
): string[] {
  const base = LIBRARY[categoryId] ?? [];
  if (categoryId !== 'shared_interests') return [...base];
  return base.map((line) => applySharedInterestWording(line, sharedInterest));
}

function rotate<T>(items: readonly T[], startIndex: number): T[] {
  if (items.length === 0) return [];
  const offset = ((startIndex % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function pickQuickPickBatch(options: {
  categoryId: ConversationStarterCategoryId;
  sharedInterest: string | null;
  refreshIndex: number;
  excludeTexts: ReadonlySet<string>;
}): string[] {
  const pool = startersForCategory(options.categoryId, options.sharedInterest);
  if (pool.length === 0) return [];

  const rotated = rotate(pool, options.refreshIndex);
  const picked: string[] = [];
  for (const line of rotated) {
    if (options.excludeTexts.has(line)) continue;
    picked.push(line);
    if (picked.length >= QUICK_PICK_DISPLAY_COUNT) break;
  }
  if (picked.length < QUICK_PICK_DISPLAY_COUNT) {
    for (const line of rotated) {
      if (picked.includes(line)) continue;
      picked.push(line);
      if (picked.length >= QUICK_PICK_DISPLAY_COUNT) break;
    }
  }
  return picked;
}

export function allCategoryIds(): ConversationStarterCategoryId[] {
  return [...CONVERSATION_STARTER_CATEGORY_ORDER];
}

export function categoryLabel(categoryId: ConversationStarterCategoryId): string {
  return CONVERSATION_STARTER_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}

/** @internal tests */
export function __conversationStarterLibraryForTests(): typeof LIBRARY {
  return LIBRARY;
}
