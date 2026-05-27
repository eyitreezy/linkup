import type { PlanFeedRow } from '@/components/plans/planFeedTypes';

/** Soft “meetup idea” tag — emotional, not transactional. Prefer catalog meet type when present. */
export function planIntentTag(row: PlanFeedRow): { emoji: string; label: string } {
  const slug = (row.meetType?.slug ?? '').toLowerCase();
  if (slug === 'gym') return { emoji: '💪', label: 'Move together' };
  if (slug === 'dinner') return { emoji: '🍽️', label: 'Share a bite' };
  if (slug === 'casual') return { emoji: '☕', label: 'Coffee & chat' };
  if (slug === 'hangout') return { emoji: '🌿', label: 'Easy hangout' };
  if (slug === 'mood') return { emoji: '🔥', label: 'Right now' };

  const cat = (row.category ?? '').toLowerCase();
  const title = (row.title ?? '').toLowerCase();
  const blob = `${cat} ${title}`;

  if (/gym|workout|run|fitness/.test(blob)) return { emoji: '💪', label: 'Move together' };
  if (/coffee|café|cafe|tea/.test(blob)) return { emoji: '☕', label: 'Coffee & chat' };
  if (/dinner|food|eat|lunch|brunch|restaurant/.test(blob)) return { emoji: '🍽️', label: 'Share a bite' };
  if (/movie|cinema|show|concert/.test(blob)) return { emoji: '🎬', label: 'Something to watch' };
  if (/walk|park|outdoor|hike/.test(blob)) return { emoji: '🌿', label: 'Easy hangout' };
  if (/network|meet|professional/.test(blob)) return { emoji: '✨', label: 'Real-life connect' };
  if (/game|board|play/.test(blob)) return { emoji: '🎲', label: 'Playful vibe' };
  return { emoji: '✨', label: 'Meetup idea' };
}
