import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflineEngine } from '../services/engines/offlineEngine.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  let audio, error, token;
  const detected = [], states = [], errors = [], transcripts = [], diagnostics = [];
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
  const engine = new OfflineEngine(options.load ?? (async () => models), capture, state => diagnostics.push(state));
  return {
    engine, detected, states, errors, transcripts, diagnostics,
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

test('one-phrase check transcribes exactly six seconds without VAD or count callbacks, then stops capture', async () => {
  let vadCalls = 0;
  const f = fixture({ hasSpeech: async samples => { vadCalls++; return samples[0] !== 0; } });
  await f.engine.initialize();
  const check = f.engine.check(msg => f.errors.push(msg), state => f.states.push(state));
  await tick();
  f.emit(0.25, 100000);
  await check;
  assert.equal(f.transcripts.length, 1);
  assert.equal(f.transcripts[0].length, 96000);
  assert.ok(f.transcripts[0].every(sample => sample === 0.25));
  assert.deepEqual(f.detected, []);
  assert.deepEqual(f.errors, []);
  assert.equal(vadCalls, 0);
  assert.equal(f.states.at(-1), false);
  assert.equal(f.diagnostics.at(-1).checkState, 'complete');
  assert.equal(f.diagnostics.at(-1).matches, 2);
  assert.equal(f.diagnostics.at(-1).utteranceSeconds, 6);
  assert.equal(f.diagnostics.at(-1).peakLevel, 0.25);
  const reports = f.diagnostics.length;
  f.emit(1); await tick(); assert.equal(f.diagnostics.length, reports);
  await f.start(); await f.utterance(); assert.deepEqual(f.detected, [2]);
  await f.engine.destroy();
});

test('cancelled one-phrase check discards partial audio and ignores late decode results', async () => {
  let resolve;
  const f = fixture({ transcribe: () => ({
    promise: new Promise(done => { resolve = done; }),
    stop: async () => { resolve({ result: 'أستغفر الله', isAborted: false }); },
  }) });
  await f.engine.initialize();
  const check = f.engine.check(() => {}, () => {});
  const rejected = assert.rejects(check, /cancelled/);
  await tick(); f.emit(1, 96000); await tick();
  await f.engine.stop(); await rejected;
  assert.deepEqual(f.detected, []);
  assert.equal(f.diagnostics.at(-1).checkState, 'decoding');
  assert.equal(f.diagnostics.at(-1).recognized, '');
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

test('voice check distinguishes received audio, speech and unmatched recognition; stale audio cannot update it', async () => {
  const f = fixture({ transcribe: () => ({ stop: async () => {}, promise: Promise.resolve({ result: 'كيف حالك', isAborted: false }) }) });
  await f.start(); await f.utterance();
  const state = f.diagnostics.at(-1);
  assert.equal(state.audioSeconds, 2);
  assert.equal(state.speechWindows, 1);
  assert.equal(state.decodedUtterances, 1);
  assert.equal(state.recognized, 'كيف حالك');
  assert.equal(state.matches, 0);
  await f.engine.stop();
  const reports = f.diagnostics.length;
  f.emit(1); await tick(); assert.equal(f.diagnostics.length, reports);
  await f.start(); assert.equal(f.diagnostics.at(-1).recognized, '');
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
