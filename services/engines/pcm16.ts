// whisper.rn 0.7.4's native requireAudioBufferArgument decodes PCM16 bytes,
// despite detectSpeechData's Float32 wording. Keep the boundary explicit.
export function toPcm16(samples: Float32Array): ArrayBuffer {
  const bytes = new ArrayBuffer(samples.length * 2);
  const view = new DataView(bytes);
  samples.forEach((sample, index) => {
    const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  });
  return bytes;
}
