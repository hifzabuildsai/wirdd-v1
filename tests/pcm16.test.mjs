import test from 'node:test';
import assert from 'node:assert/strict';
import { toPcm16 } from '../services/engines/pcm16.ts';

test('native audio boundary is little-endian signed PCM16, not Float32 bytes', () => {
  const samples = new Float32Array([-1, -0.5, 0, 0.5, 1]);
  const bytes = toPcm16(samples);
  assert.equal(bytes.byteLength, samples.length * 2);
  const view = new DataView(bytes);
  assert.deepEqual(samples.map((_, i) => view.getInt16(i * 2, true)),
    new Float32Array([-32768, -16384, 0, 16384, 32767]));
  assert.deepEqual([...new Uint8Array(bytes).slice(0, 2)], [0, 128]);
});

test('native audio boundary clips overload and sanitizes nonfinite samples', () => {
  const view = new DataView(toPcm16(new Float32Array([-2, 2, NaN, Infinity])));
  assert.deepEqual([0, 1, 2, 3].map(i => view.getInt16(i * 2, true)), [-32768, 32767, 0, 0]);
});
