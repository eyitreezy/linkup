/**
 * MatchMaker navigation icon assets (run with: npx tsx lib/navigation/matchmakerNavIcon.test.ts)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MATCHMAKER_NAV_ASSET_BASENAMES,
  MATCHMAKER_NAV_INACTIVE_FILL,
  isMatchMakerProductRoute,
  matchMakerNavIconBasename,
} from '@/lib/navigation/matchmakerNavIcon';

const assetsDir = path.join(__dirname, '../../assets/navigation');

assert.equal(MATCHMAKER_NAV_INACTIVE_FILL, '#6B7280');

assert.ok(fs.existsSync(path.join(assetsDir, MATCHMAKER_NAV_ASSET_BASENAMES.active)));
assert.ok(fs.existsSync(path.join(assetsDir, MATCHMAKER_NAV_ASSET_BASENAMES.inactive)));

assert.equal(matchMakerNavIconBasename(true), MATCHMAKER_NAV_ASSET_BASENAMES.active);
assert.equal(matchMakerNavIconBasename(false), MATCHMAKER_NAV_ASSET_BASENAMES.inactive);
assert.notEqual(MATCHMAKER_NAV_ASSET_BASENAMES.active, MATCHMAKER_NAV_ASSET_BASENAMES.inactive);

assert.equal(isMatchMakerProductRoute('/matchmaker'), true);
assert.equal(isMatchMakerProductRoute('/matchmaker/values'), true);
assert.equal(isMatchMakerProductRoute('/matchmaker/connection/abc'), true);
assert.equal(isMatchMakerProductRoute('/'), false);
assert.equal(isMatchMakerProductRoute('/messages'), false);

const activeOnValues = isMatchMakerProductRoute('/matchmaker/values?step=3'.split('?')[0]!);
assert.equal(activeOnValues, true);
assert.equal(matchMakerNavIconBasename(activeOnValues), MATCHMAKER_NAV_ASSET_BASENAMES.active);
assert.equal(
  matchMakerNavIconBasename(isMatchMakerProductRoute('/messages')),
  MATCHMAKER_NAV_ASSET_BASENAMES.inactive
);

console.log('matchmaker nav icon tests passed');
