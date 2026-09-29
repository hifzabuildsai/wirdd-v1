import test from 'node:test';
import assert from 'node:assert/strict';
import { countPhrases } from '../services/engines/countPhrases.ts';

test('counts fast repetitions in one final transcript', () => {
  assert.equal(countPhrases('أستغفر الله، أستغفر الله. استغفرالله'), 3);
  assert.equal(countPhrases('Astaghfirullah Astaghfirullahal azeem'), 2);
});

test('ignores ordinary speech and silence', () => {
  assert.equal(countPhrases(''), 0);
  assert.equal(countPhrases('Today I walked to the market'), 0);
  assert.equal(countPhrases('The rest of the conversation is unrelated'), 0);
  assert.equal(countPhrases('notastaghfirullahish'), 0);
});

test('normalizes Arabic diacritics', () => {
  assert.equal(countPhrases('أَسْتَغْفِرُ اللّٰه'), 1);
});
