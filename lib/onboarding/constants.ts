/**
 * Hinge-style prompts + chip catalogs for onboarding.
 */

/** Number of onboarding steps (Basics → … → Preview). */
export const ONBOARDING_TOTAL_STEPS = 5;

export const ONBOARDING_STEP_LABELS = [
  'Basics',
  'Personality',
  'Preferences',
  'Safety',
  'Preview',
] as const;

export const ONBOARDING_STEP_SUBTITLES = [
  'A name, a birthday, and one photo — quick.',
  'Short bio, tags, and a prompt or two.',
  'Where you are and who you’d like to meet.',
  'A few quick tips — stay in control.',
  'See how your profile will look before you publish.',
] as const;
export const HINGE_PROMPTS = [
  { id: 'green_flag', text: 'My biggest green flag is…' },
  { id: 'perfect_day', text: 'A perfect day looks like…' },
  { id: 'win_me_over', text: 'The way to win me over is…' },
  { id: 'competitive', text: "I'm overly competitive about…" },
  { id: 'simple_pleasures', text: 'My simple pleasures…' },
] as const;

export const INTEREST_TAGS = [
  'Travel',
  'Music',
  'Food',
  'Fitness',
  'Art',
  'Gaming',
  'Outdoors',
  'Reading',
  'Photography',
  'Movies',
  'Nightlife',
  'Volunteering',
  'Tech',
  'Fashion',
  'Pets',
];

export const LANGUAGE_OPTIONS = ['English', 'Spanish', 'French', 'Portuguese', 'Arabic', 'Yoruba', 'Igbo', 'Hausa'];

export const SAFETY_TIPS = [
  { icon: '💬' as const, title: 'Chat on LinkUp first', body: 'Keep early conversations in the app.' },
  { icon: '📍' as const, title: 'Meet in public', body: 'Choose busy places for first meetups.' },
  { icon: '🛡️' as const, title: 'Trust your instincts', body: 'Report anything that feels off.' },
];
