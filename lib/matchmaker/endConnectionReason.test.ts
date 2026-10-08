/**
 * Run: npx tsx lib/matchmaker/endConnectionReason.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildEndConnectionReasonForRpc,
  clampOtherReasonInput,
  END_CONNECTION_OTHER_LABEL,
} from '@/lib/matchmaker/endConnectionReason';

assert.equal(clampOtherReasonInput('a'.repeat(50)).length, 40);

const empty = buildEndConnectionReasonForRpc(END_CONNECTION_OTHER_LABEL, '  ');
assert.equal(empty.ok, false);

const one = buildEndConnectionReasonForRpc(END_CONNECTION_OTHER_LABEL, 'x');
assert.equal(one.ok, true);
if (one.ok) assert.equal(one.reason, 'Other: x');

const max = buildEndConnectionReasonForRpc(END_CONNECTION_OTHER_LABEL, 'a'.repeat(40));
assert.equal(max.ok, true);

const over = buildEndConnectionReasonForRpc(END_CONNECTION_OTHER_LABEL, 'a'.repeat(41));
assert.equal(over.ok, false);

const preset = buildEndConnectionReasonForRpc('Not feeling it', '');
assert.equal(preset.ok, true);
if (preset.ok) assert.equal(preset.reason, 'Not feeling it');

console.log('endConnectionReason tests passed');
