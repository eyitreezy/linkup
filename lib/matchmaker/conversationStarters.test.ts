/**
 * Quick-Pick conversation starter library (run: npx tsx lib/matchmaker/conversationStarters.test.ts)
 */
import assert from 'node:assert/strict';
import {
  CONVERSATION_STARTER_CATEGORIES,
  CONVERSATION_STARTER_CATEGORY_ORDER,
  applySharedInterestWording,
  pickQuickPickBatch,
  sharedPublicInterests,
  __conversationStarterLibraryForTests,
} from '@/lib/matchmaker/conversationStarters';

assert.deepEqual(
  CONVERSATION_STARTER_CATEGORIES.map((c) => c.id),
  [...CONVERSATION_STARTER_CATEGORY_ORDER]
);

const lib = __conversationStarterLibraryForTests();
for (const id of CONVERSATION_STARTER_CATEGORY_ORDER) {
  assert.equal(lib[id].length, 5, `${id} should have five starters`);
  for (const line of lib[id]) {
    assert.ok(line.trim().length > 0, `${id} has empty line`);
  }
}

assert.deepEqual(
  sharedPublicInterests({ interests: ['hiking', 'coffee'] }, { interests: ['coffee', 'music'] }),
  ['coffee']
);

const personalized = applySharedInterestWording(
  "I noticed we both enjoy this. What's your favourite part of it?",
  'Photography'
);
assert.ok(personalized.includes('Photography'));
assert.ok(!personalized.includes(' enjoy this'));

const generic = applySharedInterestWording(
  'We seem to have something in common. How did you first get into it?',
  null
);
assert.equal(generic, 'We seem to have something in common. How did you first get into it?');

const first = pickQuickPickBatch({
  categoryId: 'easy_icebreakers',
  sharedInterest: null,
  refreshIndex: 0,
  excludeTexts: new Set(),
});
const second = pickQuickPickBatch({
  categoryId: 'easy_icebreakers',
  sharedInterest: null,
  refreshIndex: 1,
  excludeTexts: new Set(),
});
assert.notEqual(first[0], second[0]);

console.log('conversationStarters.test.ts: all assertions passed');
