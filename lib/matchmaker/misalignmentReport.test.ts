/**
 * run: node node_modules/tsx/dist/cli.mjs lib/matchmaker/misalignmentReport.test.ts
 */
import assert from 'node:assert/strict';
import {
  MISALIGNMENT_REPORT_MAX_EXPLANATION,
  MISALIGNMENT_REPORT_REASONS,
  sanitizeMisalignmentExplanation,
  validateMisalignmentSubmission,
} from '@/lib/matchmaker/misalignmentReport';

assert.equal(MISALIGNMENT_REPORT_REASONS.length, 5);
assert.deepEqual(validateMisalignmentSubmission(null, ''), {
  ok: false,
  error: 'Select a reason before submitting.',
});
assert.equal(validateMisalignmentSubmission('not_sincere', 'ok').ok, true);
assert.equal(
  sanitizeMisalignmentExplanation('x'.repeat(300)).length,
  MISALIGNMENT_REPORT_MAX_EXPLANATION
);

console.log('misalignmentReport tests passed');
