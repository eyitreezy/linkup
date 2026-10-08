/**
 * Lightweight journey clock checks (run with: npx tsx lib/matchmaker/journey.test.ts)
 */
import assert from 'node:assert/strict';
import { computeMatchMakerJourneyClocks } from '@/lib/matchmaker/journey';
import type { MatchMakerConnection } from '@/lib/matchmaker/types';

function baseConnection(overrides: Partial<MatchMakerConnection>): MatchMakerConnection {
  return {
    id: 'c1',
    status: 'active',
    user_a_id: 'a',
    user_b_id: 'b',
    connected_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    first_message_at: null,
    plan_unlock_at: null,
    first_plan_created_at: null,
    ended_at: null,
    ...overrides,
  };
}

const now = Date.now();
const clocksNoMessage = computeMatchMakerJourneyClocks(baseConnection({}), now);
assert.equal(clocksNoMessage.planWindowOpen, false);
assert.equal(clocksNoMessage.sharedActivityUnlocked, true);

const withMessage = baseConnection({
  first_message_at: new Date(now - 2 * 86400000).toISOString(),
  plan_unlock_at: new Date(now + 19 * 86400000).toISOString(),
});
const clocksMessage = computeMatchMakerJourneyClocks(withMessage, now);
assert.equal(clocksMessage.planWindowOpen, false);
assert.ok((clocksMessage.planDaysRemaining ?? 0) > 0);

console.log('matchmaker journey tests passed');
