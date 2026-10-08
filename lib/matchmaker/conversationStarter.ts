/** Build a day-10 check-in prompt from public profile fields only (no MatchMaker values). */
export function buildCheckInConversationStarter(
  partnerName: string,
  sharedInterests: string[]
): string {
  const name = partnerName.trim() || 'them';
  const interest = sharedInterests.find((i) => typeof i === 'string' && i.trim().length > 0);
  if (interest) {
    return `Ask ${name}: What got you into ${interest.trim()}?`;
  }
  return `Ask ${name}: What is something you have always wanted to try but never had the chance to?`;
}
