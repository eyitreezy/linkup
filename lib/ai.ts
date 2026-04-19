/**
 * AI: profile trust scoring, content moderation, abuse heuristics.
 * Production: route via Supabase Edge Functions so API keys never ship in the app.
 * This module falls back to deterministic mocks when no endpoint is configured.
 */
import Constants from 'expo-constants';

const edgeUrl = Constants.expoConfig?.extra?.aiEdgeUrl as string | undefined;

export type AiScoreResult = {
  trust_score: number;
  flags: string[];
  labels?: string[];
};

/** Simple hash of text for demo “fake/spam” heuristics (replace with model output). */
function heuristicFlags(text: string): string[] {
  const flags: string[] = [];
  const lower = text.toLowerCase();
  if (/click here|free money|whatsapp \+?\d{10}/i.test(lower)) flags.push('spam_pattern');
  if (lower.length < 3) flags.push('too_short');
  if (lower.length > 2000) flags.push('too_long');
  return flags;
}

export async function scoreProfileBio(bio: string): Promise<AiScoreResult> {
  const flags = heuristicFlags(bio);
  let trust = 0.75 - flags.length * 0.1;
  trust = Math.max(0, Math.min(1, trust));

  if (edgeUrl) {
    try {
      const res = await fetch(`${edgeUrl}/profile-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      if (res.ok) return (await res.json()) as AiScoreResult;
    } catch {
      /* fall through */
    }
  }

  return { trust_score: trust, flags };
}

export async function moderateMessageText(body: string): Promise<{
  status: 'clean' | 'flagged' | 'blocked';
  reason?: string;
}> {
  const flags = heuristicFlags(body);
  if (flags.includes('spam_pattern')) return { status: 'flagged', reason: 'spam_pattern' };
  if (body.match(/kill yourself|kys/i)) return { status: 'blocked', reason: 'abuse' };
  return { status: 'clean' };
}
