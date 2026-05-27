import Ionicons from '@expo/vector-icons/Ionicons';

export type MeetTypeIonIcon = keyof typeof Ionicons.glyphMap;

const DEFAULT_ICON: MeetTypeIonIcon = 'sparkles-outline';

const RULES: { re: RegExp; icon: MeetTypeIonIcon }[] = [
  { re: /gym|workout|fitness|lift|run|yoga|sport/i, icon: 'barbell-outline' },
  { re: /coffee|café|cafe|tea|brunch/i, icon: 'cafe-outline' },
  { re: /dinner|lunch|food|eat|restaurant|bbq|grill/i, icon: 'restaurant-outline' },
  { re: /movie|cinema|film|watch|netflix/i, icon: 'film-outline' },
  { re: /walk|park|hike|nature|outdoor|beach/i, icon: 'leaf-outline' },
  { re: /music|concert|gig|jam|party|club/i, icon: 'musical-notes-outline' },
  { re: /game|board|play|esports/i, icon: 'game-controller-outline' },
  { re: /book|read|study|library/i, icon: 'book-outline' },
  { re: /travel|trip|flight|road/i, icon: 'airplane-outline' },
  { re: /work|network|meetup|biz|startup/i, icon: 'briefcase-outline' },
  { re: /art|museum|gallery|paint/i, icon: 'color-palette-outline' },
  { re: /photo|camera|shoot/i, icon: 'camera-outline' },
  { re: /kids|family|child/i, icon: 'people-outline' },
  { re: /wine|bar|drink|cocktail/i, icon: 'beer-outline' },
];

export function inferMeetTypeIcon(title: string): MeetTypeIonIcon {
  const t = title.trim();
  if (!t) return DEFAULT_ICON;
  for (const { re, icon } of RULES) {
    if (re.test(t)) return icon;
  }
  return DEFAULT_ICON;
}
