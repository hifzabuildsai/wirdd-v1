import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import { Buffer } from 'safe-buffer';
import { OfflineEngine } from './offlineEngine';
import type { OfflineCapture, OfflineModels } from './offlineEngine';

type AudioModule = {
  start(token: number): Promise<void>;
  stop(): Promise<void>;
  addListener(name: 'onAudio', callback: (event: { token: number; pcm: string }) => void): { remove(): void };
  addListener(name: 'onError', callback: (event: { token: number; message: string }) => void): { remove(): void };
};
let native: AudioModule | null = null;
function audioModule(): AudioModule { return native ??= requireNativeModule<AudioModule>('WirddAudio'); }
const capture: OfflineCapture = {
  start: token => audioModule().start(token),
  stop: () => native?.stop() ?? Promise.resolve(),
  subscribe: (onAudio, onError) => {
    const audio = audioModule();
    const data = audio.addListener('onAudio', event => {
      const bytes = Buffer.from(event.pcm, 'base64');
      const samples = new Float32Array(bytes.length / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(i * 2) / 32768;
      onAudio(event.token, samples);
    });
    const error = audio.addListener('onError', event => onError(event.token, event.message));
    return () => { data.remove(); error.remove(); };
  },
};
async function loadModels(): Promise<OfflineModels> {
  if (Platform.OS !== 'android') throw new Error('Voice sessions require Android.');
  // Lazy import: a missing native binding must give a recoverable start error,
  // not prevent manual sessions or the rest of the app from opening.
  const { initWhisper, initWhisperVad } = await import('whisper.rn/index');
  const whisper = await initWhisper({
    filePath: require('../../assets/models/ggml-tiny.bin'), useGpu: false, useCoreMLIos: false,
  });
  try {
    const vad = await initWhisperVad({
      filePath: require('../../assets/models/ggml-silero-v6.2.0.bin'), useGpu: false, nThreads: 1,
    });
    return {
      hasSpeech: async samples => (await vad.detectSpeechData(samples.buffer as ArrayBuffer, {
        threshold: 0.5, minSpeechDurationMs: 100, minSilenceDurationMs: 100,
        maxSpeechDurationS: 0.5, speechPadMs: 0, samplesOverlap: 0,
      })).length > 0,
      transcribe: samples => whisper.transcribeData(samples.buffer as ArrayBuffer, {
        language: 'ar', translate: false, maxThreads: 4, maxContext: 0,
        temperature: 0, temperatureInc: 0,
      }),
      release: async () => { await vad.release(); await whisper.release(); },
    };
  } catch (error) { await whisper.release(); throw error; }
}
export class WhisperEngine extends OfflineEngine {
  constructor() { super(loadModels, capture); }
}
