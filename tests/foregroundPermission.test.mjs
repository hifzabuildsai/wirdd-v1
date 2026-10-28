import test from 'node:test';
import assert from 'node:assert/strict';
import { foregroundPermission } from '../services/engines/foregroundPermission.ts';

test('permission modal may background Activity, but capture proceeds only after returning to foreground', async () => {
  let prompt = false, active = false, release;
  const phases = [];
  const pending = foregroundPermission(
    () => new Promise(resolve => { release = resolve; }),
    value => { prompt = value; phases.push(value); },
    () => { assert.equal(prompt, false); if (!active) throw new Error('background'); },
  );
  assert.equal(prompt, true);
  active = true; release(); await pending;
  assert.deepEqual(phases, [true, false]);
});

test('grant after leaving app cannot start capture', async () => {
  await assert.rejects(foregroundPermission(async () => {}, () => {}, () => { throw new Error('background'); }), /background/);
});

test('permission failure clears modal flag and does not run capture guard', async () => {
  const phases = []; let checked = false;
  await assert.rejects(foregroundPermission(async () => { throw new Error('denied'); }, value => phases.push(value), () => { checked = true; }), /denied/);
  assert.deepEqual(phases, [true, false]); assert.equal(checked, false);
});

test('cancelled start during permission cannot proceed after permission grant', async () => {
  let cancelled = false, release;
  const pending = foregroundPermission(() => new Promise(resolve => { release = resolve; }), () => {}, () => { if (cancelled) throw new Error('cancelled'); });
  cancelled = true; release(); await assert.rejects(pending, /cancelled/);
});
