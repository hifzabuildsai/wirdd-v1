import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflineEngine } from '../services/engines/offlineEngine.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  let audio, error, token;
  const detected = [], states = [], errors = [], transcripts = [];
  let stopped = 0, released = 0;
  const models = {
    hasSpeech: options.hasSpeech ?? (async samples => samples[0] !== 0),
    transcribe: samples => {
      transcripts.push(samples);
      return options.transcribe?.(samples) ?? { stop: async () => {}, promise: Promise.resolve({ result: 'أستغفر الله أستغفر الله', isAborted: false }) };
    },
    release: async () => { released++; },
  };
  const capture = {
    subscribe: (data, fail) => { audio = data; error = fail; return () => {}; },
    start: async next => { token = next; options.start?.(); },
    stop: async () => { stopped++; },
  };
  const engine = new OfflineEngine(options.load ?? (async () => models), capture);
  return {
    engine, detected, states, errors, transcripts,
    get stopped() { return stopped; }, get released() { return released; },
    async start() {
      await engine.initialize();
      const starting = engine.start(count => detected.push(count), msg => errors.push(msg), state => states.push(state));
      await tick(); this.emit(0); await starting;
    },
    emit(value, length = 8000, eventToken = token) { audio(eventToken, new Float32Array(length).fill(value)); },
    fail(msg) { error(token, msg); },
    async utterance() { this.emit(1); await tick(); this.emit(0); await tick(); this.emit(0); await tick(); await tick(); },
  };
}

test('offline mic waits for actual PCM, not just a successful native start', async () => {
  const f = fixture(); await f.engine.initialize();
  let ready = false;
  const start = f.engine.start(() => {}, () => {}, state => f.states.push(state)).then(() => { ready = true; });
  await tick(); assert.equal(ready, false); assert.deepEqual(f.states, []);
  f.emit(0, 2048); await start; assert.equal(ready, true); assert.deepEqual(f.states, [true]);
  await f.engine.destroy();
});

test('silence never reaches Whisper decoding', async () => {
  const f = fixture(); await f.start();
  for (let i = 0; i < 20; i++) { f.emit(0); await tick(); }
  assert.equal(f.transcripts.length, 0); assert.deepEqual(f.detected, []);
  await f.engine.destroy();
});

test('counts repeated phrases once per disjoint complete utterance', async () => {
  const f = fixture(); await f.start(); await f.utterance(); await f.utterance();
  assert.deepEqual(f.detected, [2, 2]); assert.equal(f.transcripts.length, 2);
  await f.engine.destroy();
});

test('unrelated speech does not add a count', async () => {
  const f = fixture({ transcribe: () => ({ stop: async () => {}, promise: Promise.resolve({ result: 'كيف حالك اليوم', isAborted: false }) }) });
  await f.start(); await f.utterance(); assert.deepEqual(f.detected, []);
  await f.engine.destroy();
});

test('pause aborts decoding and ignores a late result from old audio', async () => {
  let resolve, aborted = 0;
  const f = fixture({ transcribe: () => ({
    promise: new Promise(done => { resolve = done; }),
    stop: async () => { aborted++; resolve({ result: 'أستغفر الله', isAborted: false }); },
  }) });
  await f.start(); await f.utterance(); await f.engine.stop();
  assert.equal(aborted, 1); assert.deepEqual(f.detected, []); assert.equal(f.states.at(-1), false);
  await f.engine.destroy();
});

test('resume discards unfinished pre-pause speech and rejects stale native tokens', async () => {
  const f = fixture(); await f.start(); f.emit(1); await tick(); await f.engine.stop();
  await f.start(); f.emit(1, 8000, -1); f.emit(0); await tick(); f.emit(0); await tick();
  assert.deepEqual(f.detected, []); await f.utterance(); assert.deepEqual(f.detected, [2]);
  await f.engine.destroy();
});

test('native interruption stops capture and reports a recoverable error', async () => {
  const f = fixture(); await f.start(); f.fail('Microphone interrupted'); await tick();
  assert.deepEqual(f.errors, ['Microphone interrupted']); assert.equal(f.states.at(-1), false); assert.ok(f.stopped > 0);
  f.emit(1); await tick(); assert.deepEqual(f.detected, []); await f.engine.destroy();
});

test('VAD backlog fails closed instead of silently discarding recitations', async () => {
  let resolve;
  const f = fixture({ hasSpeech: () => new Promise(done => { resolve = done; }) });
  await f.start(); f.emit(1); await tick();
  for (let i = 0; i < 10; i++) f.emit(1);
  assert.match(f.errors[0], /falling behind/); resolve(true); await tick();
  assert.deepEqual(f.detected, []); await f.engine.destroy();
});

test('destroy during model load releases the late context', async () => {
  let resolve, released = 0;
  const f = fixture({ load: () => new Promise(done => { resolve = done; }) });
  const init = f.engine.initialize(); const rejection = assert.rejects(init, /cancelled/);
  const destroy = f.engine.destroy(); resolve({ release: async () => { released++; } });
  await rejection; await destroy; assert.equal(released, 1);
});

test('native startup rejection releases capture and permits retry', async () => {
  let attempts = 0;
  const f = fixture({ start: () => { if (++attempts === 1) throw new Error('permission revoked'); } });
  await f.engine.initialize();
  await assert.rejects(f.engine.start(() => {}, () => {}, () => {}), /permission revoked/);
  assert.ok(f.stopped > 0); await f.start(); await f.utterance();
  assert.deepEqual(f.detected, [2]); await f.engine.destroy();
});

test('no-audio watchdog stops a native capture that never delivers PCM', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000 });
  const f = fixture(); await f.engine.initialize();
  const start = f.engine.start(() => {}, msg => f.errors.push(msg), () => {});
  const rejected = assert.rejects(start, /stopped|cancelled/);
  await tick(); t.mock.timers.tick(6000); await rejected;
  assert.match(f.errors[0], /stopped delivering audio/);
  await f.engine.destroy();
});

test('decoder backlog reports an error instead of dropping queued audio', async () => {
  let resolve;
  const f = fixture({ transcribe: () => ({
    promise: new Promise(done => { resolve = done; }),
    stop: async () => { resolve({ result: '', isAborted: true }); },
  }) });
  await f.start();
  for (let i = 0; i < 4; i++) await f.utterance();
  assert.match(f.errors[0], /falling behind/); await tick();
  assert.deepEqual(f.detected, []); await f.engine.destroy();
});
