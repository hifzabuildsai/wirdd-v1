import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechEngine } from '../services/engines/speechEngine.ts';

function fixture(t, version = 33) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const listeners = new Map();
  const starts = [];
  const counts = [];
  const errors = [];
  const audio = [];
  let aborts = 0;
  const speech = {
    isRecognitionAvailable: () => true,
    supportsOnDeviceRecognition: () => true,
    addListener: (name, fn) => {
      listeners.set(name, fn);
      return { remove: () => listeners.delete(name) };
    },
    start: options => starts.push(options),
    abort: () => aborts++,
  };
  const engine = new SpeechEngine(speech, { OS: 'android', Version: version });
  t.after(() => engine.stop());
  return {
    engine, speech, starts, counts, errors, audio, listeners,
    get aborts() { return aborts; },
    emit: (name, value = {}) => listeners.get(name)?.(value),
    start: () => engine.start(n => counts.push(n), e => errors.push(e), a => audio.push(a)),
  };
}

test('Android 12 is blocked before any recognition request', async t => {
  const f = fixture(t, 31);
  await assert.rejects(f.engine.initialize(), /Android 13/);
  assert.equal(f.starts.length, 0);
});

test('unavailable on-device engine fails closed', async t => {
  const f = fixture(t);
  f.speech.supportsOnDeviceRecognition = () => false;
  await assert.rejects(f.engine.initialize(), /unavailable/);
  assert.equal(f.starts.length, 0);
});

test('startup resolves only after audio starts; duplicate finals count once', async t => {
  const f = fixture(t);
  await f.engine.initialize();
  const started = f.start();
  assert.equal(f.audio.length, 0);
  assert.equal(f.starts[0].requiresOnDeviceRecognition, true);
  assert.equal(f.starts[0].lang, 'ar-SA');
  f.emit('audiostart');
  await started;
  f.emit('result', { isFinal: false, results: [{ transcript: 'استغفر الله' }] });
  f.emit('result', { isFinal: true, results: [{ transcript: 'استغفر الله استغفر الله' }, { transcript: 'استغفر الله' }] });
  f.emit('result', { isFinal: true, results: [{ transcript: 'استغفر الله' }] });
  assert.deepEqual(f.counts, [2]);
  f.emit('audioend');
  assert.deepEqual(f.audio, [true, false]);
});

test('a second cycle can count the same phrase without a time debounce', async t => {
  const f = fixture(t);
  const started = f.start();
  f.emit('audiostart');
  await started;
  const result = { isFinal: true, results: [{ transcript: 'استغفر الله' }] };
  f.emit('result', result);
  f.emit('end');
  f.emit('end');
  f.emit('result', result); // stale result before the next cycle
  t.mock.timers.tick(250);
  f.emit('audiostart');
  f.emit('result', result);
  assert.equal(f.starts.length, 2);
  assert.deepEqual(f.counts, [1, 1]);
});

test('repeated end events cannot extend the startup deadline', async t => {
  const f = fixture(t);
  const started = f.start();
  const rejected = assert.rejects(started, /did not start/);
  for (let i = 0; i < 32; i++) {
    f.emit('end');
    t.mock.timers.tick(250);
  }
  await rejected;
  assert.equal(f.errors.length, 1);
  assert.equal(f.listeners.size, 0);
});

test('stop while starting rejects pending startup and releases callbacks', async t => {
  const f = fixture(t);
  const started = f.start();
  const rejected = assert.rejects(started, /stopped/);
  await f.engine.stop();
  await rejected;
  f.emit('audiostart');
  t.mock.timers.tick(20_000);
  assert.equal(f.starts.length, 1);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.audio.at(-1), false);
});

test('missing Arabic model produces manual fallback guidance and shuts down', async t => {
  const f = fixture(t);
  const started = f.start();
  f.emit('audiostart');
  await started;
  f.emit('error', { error: 'language-not-supported' });
  assert.match(f.errors[0], /Arabic offline.*model/);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.audio.at(-1), false);
});

test('stop cancels recognition restart and retry is possible', async t => {
  const f = fixture(t);
  let started = f.start();
  f.emit('audiostart');
  await started;
  f.emit('end');
  await f.engine.stop();
  t.mock.timers.tick(10_000);
  assert.equal(f.starts.length, 1);
  started = f.start();
  f.emit('audiostart');
  await started;
  assert.equal(f.starts.length, 2);
});

test('restart with no audio fails rather than claiming to listen', async t => {
  const f = fixture(t);
  const started = f.start();
  f.emit('audiostart');
  await started;
  f.emit('end');
  t.mock.timers.tick(250);
  t.mock.timers.tick(8000);
  assert.match(f.errors[0], /did not restart/);
  assert.equal(f.audio.at(-1), false);
});

test('recognizer stuck after audioend fails safely instead of hanging forever', async t => {
  const f = fixture(t);
  const started = f.start();
  f.emit('audiostart');
  await started;
  f.emit('audioend');
  t.mock.timers.tick(8000);
  assert.match(f.errors[0], /did not finish/);
  assert.equal(f.listeners.size, 0);
});
