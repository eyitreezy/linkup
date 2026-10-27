/**
 * run: node node_modules/tsx/dist/cli.mjs lib/matchmaker/sharedActivityCatalog.test.ts
 */
import assert from 'node:assert/strict';
import {
  SHARED_ACTIVITY_CATALOG,
  SHARED_ACTIVITY_MAX_WEEKS,
  sharedActivityWeekDefinition,
} from '@/lib/matchmaker/sharedActivityCatalog';

assert.equal(SHARED_ACTIVITY_MAX_WEEKS, 8);
assert.equal(SHARED_ACTIVITY_CATALOG.length, 8);
assert.ok(sharedActivityWeekDefinition(1)?.question.includes('Sunday'));
assert.equal(sharedActivityWeekDefinition(99), null);

console.log('sharedActivityCatalog tests passed');
