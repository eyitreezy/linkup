/**
 * Run: npx tsx lib/matchmaker/sharedActivity.test.ts
 */
import assert from 'node:assert/strict';
import {
  clampSharedActivityOtherInput,
  formatActivityAnswerDisplay,
  normalizeActivityAnswerForSubmit,
  SHARED_ACTIVITY_OTHER_LABEL,
} from '@/lib/matchmaker/sharedActivity';

assert.equal(clampSharedActivityOtherInput('a'.repeat(120)).length, 100);

const emptyOther = normalizeActivityAnswerForSubmit(SHARED_ACTIVITY_OTHER_LABEL, '   ', true);
assert.equal(emptyOther.ok, false);

const okOther = normalizeActivityAnswerForSubmit(SHARED_ACTIVITY_OTHER_LABEL, 'Custom day', true);
assert.equal(okOther.ok, true);
if (okOther.ok) {
  assert.deepEqual(okOther.payload, { kind: 'other', text: 'Custom day' });
}

const tooLong = normalizeActivityAnswerForSubmit(
  SHARED_ACTIVITY_OTHER_LABEL,
  'x'.repeat(101),
  true
);
assert.equal(tooLong.ok, false);

const preset = normalizeActivityAnswerForSubmit('Outdoor adventure', '', false);
assert.equal(preset.ok, true);
if (preset.ok) assert.equal(preset.payload, 'Outdoor adventure');

assert.equal(formatActivityAnswerDisplay({ kind: 'other', text: 'Hello' }), 'Hello');
assert.equal(formatActivityAnswerDisplay('Preset'), 'Preset');

console.log('sharedActivity tests passed');
