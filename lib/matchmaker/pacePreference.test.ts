/**
 * Pace preference copy and persistence (run with: npx tsx lib/matchmaker/pacePreference.test.ts)
 */
import assert from 'node:assert/strict';
import {
  PACE_PREFERENCE_OPTIONS,
  PACE_PREFERENCE_PRIVATE_LABEL,
  PACE_PREFERENCE_QUESTION,
  PACE_PREFERENCE_STEP_TITLE,
  pacePreferenceDbFromUi,
  pacePreferenceDisplayLabel,
  parsePacePreferenceUiFromDb,
} from '@/lib/matchmaker/pacePreference';

assert.equal(PACE_PREFERENCE_STEP_TITLE, 'Pace Preference');
assert.equal(PACE_PREFERENCE_QUESTION, 'How long after connecting do you expect to meet?');
assert.equal(PACE_PREFERENCE_PRIVATE_LABEL, 'Private. Used for compatibility weighting only.');
assert.deepEqual(
  PACE_PREFERENCE_OPTIONS.map((o) => o.label),
  [
    'As soon as the platform allows (7 day minimum)',
    '1 to 2 weeks',
    '2 to 3 weeks',
    'I take my time, 1 months or more',
  ]
);

for (const opt of PACE_PREFERENCE_OPTIONS) {
  assert.equal(pacePreferenceDbFromUi(opt.key), opt.db);
  assert.equal(parsePacePreferenceUiFromDb(opt.db), opt.key);
  assert.equal(pacePreferenceDisplayLabel(opt.db), opt.label);
}

assert.equal(parsePacePreferenceUiFromDb('one_two_months'), null);
assert.equal(pacePreferenceDisplayLabel('one_two_months'), '1 to 2 months');
assert.equal(parsePacePreferenceUiFromDb('platform_minimum'), null);
assert.equal(
  pacePreferenceDisplayLabel('platform_minimum'),
  'As soon as the platform allows (21 days minimum)'
);
assert.equal(parsePacePreferenceUiFromDb('unknown_value'), null);
assert.equal(pacePreferenceDisplayLabel('unknown_value'), 'Not set');
assert.equal(pacePreferenceDbFromUi(null), null);
assert.equal(pacePreferenceDbFromUi('asap'), 'asap_7_days');

console.log('pace preference tests passed');
