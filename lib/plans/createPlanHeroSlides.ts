import type { ImageSourcePropType } from 'react-native';

/**
 * Create Plan hero carousel — photographic slides.
 *
 * Replace images under `assets/create-plan-hero/` (keep the same filenames):
 * coffee.jpg, dinner.jpg, network.jpg, study.jpg, gym.jpg, chill.jpg, event.jpg, mood.jpg
 *
 * Current files are copies of auth-hero placeholders until you drop in real photos.
 */
export type CreatePlanHeroSlideDef = {
  key: string;
  title: string;
  caption: string;
  icon: 'cafe-outline' | 'wine-outline' | 'people-outline' | 'book-outline' | 'barbell-outline' | 'happy-outline' | 'musical-notes-outline' | 'flash-outline';
  source: ImageSourcePropType;
};

export const CREATE_PLAN_HERO_SLIDES: CreatePlanHeroSlideDef[] = [
  {
    key: 'coffee',
    title: 'Coffee meetup',
    caption: 'Warm, low-pressure, easy to say yes.',
    icon: 'cafe-outline',
    source: require('@/assets/create-plan-hero/coffee.jpg'),
  },
  {
    key: 'dinner',
    title: 'Dinner date',
    caption: 'Good food, real conversation.',
    icon: 'wine-outline',
    source: require('@/assets/create-plan-hero/dinner.jpg'),
  },
  {
    key: 'network',
    title: 'Networking',
    caption: 'Curated serendipity for your next intro.',
    icon: 'people-outline',
    source: require('@/assets/create-plan-hero/network.jpg'),
  },
  {
    key: 'study',
    title: 'Study session',
    caption: 'Focus together — short wins count.',
    icon: 'book-outline',
    source: require('@/assets/create-plan-hero/study.jpg'),
  },
  {
    key: 'gym',
    title: 'Gym partner',
    caption: 'Accountability that feels human.',
    icon: 'barbell-outline',
    source: require('@/assets/create-plan-hero/gym.jpg'),
  },
  {
    key: 'chill',
    title: 'Chill hangout',
    caption: 'No agenda — just good vibes nearby.',
    icon: 'happy-outline',
    source: require('@/assets/create-plan-hero/chill.jpg'),
  },
  {
    key: 'event',
    title: 'Event buddy',
    caption: 'Shared tickets, shared memories.',
    icon: 'musical-notes-outline',
    source: require('@/assets/create-plan-hero/event.jpg'),
  },
  {
    key: 'mood',
    title: 'Mood plan',
    caption: 'Live in the moment — discover reacts in real time.',
    icon: 'flash-outline',
    source: require('@/assets/create-plan-hero/mood.jpg'),
  },
];
