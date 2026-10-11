import { countPhrases } from './countPhrases.ts';
import type { VoiceDetectionEngine } from './voiceDetectionEngine';

export type OfflineModels = {
  hasSpeech(samples: Float32Array): Promise<boolean>;
  transcribe(samples: Float32Array): { stop(): Promise<void>; promise: Promise<{ result: string; isAborted: boolean }> };
  release(): Promise<void>;
};
export type OfflineCapture = {
  start(token: number): Promise<void>;
  stop(): Promise<void>;
  subscribe(audio: (token: number, samples: Float32Array) => void, error: (token: number, message: string) => void): () => void;
};

// 16 kHz PCM, half-second VAD windows. Disjoint utterances are counted once,
// after a second of silence, rather than counting revisable partial transcripts.
const WINDOW = 8000;
export type VoiceDiagnostics = {
  audioSeconds: number; level: number; speechWindows: number;
  decodedUtterances: number; recognized: string; matches: number;
};
export const emptyDiagnostics = (): VoiceDiagnostics => ({
  audioSeconds: 0, level: 0, speechWindows: 0, decodedUtterances: 0, recognized: '', matches: 0,
});
let nextToken = Math.floor(Date.now() % 1_000_000_000);
export class OfflineEngine implements VoiceDetectionEngine {
  private load: () => Promise<OfflineModels>;
  private capture: OfflineCapture;
  private models: OfflineModels | null = null;
  private loading: Promise<void> | null = null;
  private destroyed = false;
  private running = false;
  private token = 0;
  private unsubscribe: (() => void) | null = null;
  private startup: { resolve(): void; reject(error: Error): void } | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private decodeDeadline: ReturnType<typeof setTimeout> | null = null;
  private lastAudio = 0;
  private pending = new Float32Array(0);
  private vadQueue: Float32Array[] = [];
  private utterance: Float32Array[] = [];
  private preRoll: Float32Array | null = null;
  private silenceWindows = 0;
  private speechWindows = 0;
  private transcriptionQueue: Float32Array[] = [];
  private vadWork: Promise<void> | null = null;
  private decodeWork: Promise<void> | null = null;
  private job: ReturnType<OfflineModels['transcribe']> | null = null;
  private stopping: Promise<void> | null = null;
  private detect: ((count: number) => void) | null = null;
  private error: ((message: string) => void) | null = null;
  private audioState: ((listening: boolean) => void) | null = null;
  private diagnostics = emptyDiagnostics();
  private lastDiagnostic = 0;
  private report: ((state: VoiceDiagnostics) => void) | undefined;

  constructor(load: () => Promise<OfflineModels>, capture: OfflineCapture, report?: (state: VoiceDiagnostics) => void) {
    this.load = load;
    this.capture = capture;
    this.report = report;
  }

  initialize(): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Voice engine has been closed.'));
    if (this.models) return Promise.resolve();
    if (!this.loading) {
      this.loading = (async () => {
        const models = await this.load();
        if (this.destroyed) { await models.release(); throw new Error('Voice setup cancelled.'); }
        this.models = models;
      })().finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  async start(detect: (count: number) => void, error: (message: string) => void, audioState: (listening: boolean) => void): Promise<void> {
    if (this.stopping) await this.stopping;
    if (this.running) return;
    if (!this.models || this.destroyed) throw new Error('Offline voice model is unavailable. Retry or count manually.');
    this.running = true;
    this.diagnostics = emptyDiagnostics();
    this.lastDiagnostic = 0;
    this.token = ++nextToken;
    const token = this.token;
    this.detect = detect;
    this.error = error;
    this.audioState = audioState;
    const ready = new Promise<void>((resolve, reject) => { this.startup = { resolve, reject }; });
    // Attach before capture.start, including a handler for an early native failure.
    void ready.catch(() => {});
    this.lastAudio = Date.now();
    try {
    this.unsubscribe = this.capture.subscribe(
      (eventToken, samples) => { if (this.running && eventToken === this.token) this.accept(samples); },
      (eventToken, message) => { if (this.running && eventToken === this.token) this.fail(message); },
    );
    this.watchdog = setInterval(() => {
      if (this.running && Date.now() - this.lastAudio > 5000) this.fail('Microphone stopped delivering audio. Retry the session.');
    }, 1000);
      await this.capture.start(token);
      if (!this.running || this.token !== token) throw new Error('Microphone start cancelled.');
      await ready;
    } catch (cause) {
      await this.stop();
      throw cause;
    }
  }

  private accept(samples: Float32Array) {
    this.lastAudio = Date.now();
    let power = 0;
    for (const sample of samples) power += sample * sample;
    this.diagnostics.audioSeconds += samples.length / 16000;
    this.diagnostics.level = samples.length ? Math.sqrt(power / samples.length) : 0;
    this.publishDiagnostics();
    if (this.startup) { this.audioState?.(true); this.startup.resolve(); this.startup = null; }
    const combined = new Float32Array(this.pending.length + samples.length);
    combined.set(this.pending); combined.set(samples, this.pending.length);
    let offset = 0;
    while (combined.length - offset >= WINDOW) {
      this.vadQueue.push(combined.slice(offset, offset + WINDOW)); offset += WINDOW;
    }
    this.pending = combined.slice(offset);
    if (this.vadQueue.length > 8) { this.fail('Voice processing is falling behind. Pause and retry in a quiet place.'); return; }
    this.runVad();
  }

  private runVad() {
    if (this.vadWork || !this.running) return;
    const token = this.token;
    this.vadWork = (async () => {
      while (this.running && this.token === token && this.vadQueue.length) {
        const window = this.vadQueue.shift()!;
        const speech = await this.models!.hasSpeech(window);
        if (!this.running || token !== this.token) return;
        if (speech) {
          this.diagnostics.speechWindows++;
          this.publishDiagnostics();
          if (!this.utterance.length && this.preRoll) this.utterance.push(this.preRoll);
          this.utterance.push(window);
          this.silenceWindows = 0;
          this.speechWindows++;
        } else if (this.utterance.length) {
          this.utterance.push(window);
          this.silenceWindows++;
          if (this.silenceWindows >= 2) this.finishUtterance();
        }
        // Never reuse speech-bearing audio in the next utterance.
        this.preRoll = speech ? null : window;
        if (this.utterance.length > 40) {
          this.fail('Pause briefly between recitations so Wirdd can finish counting.'); return;
        }
      }
    })().catch(() => { if (this.running && token === this.token) this.fail('Offline speech detection failed. Retry the session.'); })
      .finally(() => { this.vadWork = null; if (this.running && this.vadQueue.length) this.runVad(); });
  }

  private finishUtterance() {
    if (this.speechWindows > 0) {
      const audio = new Float32Array(this.utterance.length * WINDOW);
      this.utterance.forEach((window, index) => audio.set(window, index * WINDOW));
      this.transcriptionQueue.push(audio);
    }
    this.utterance = []; this.speechWindows = 0; this.silenceWindows = 0;
    if (this.transcriptionQueue.length > 2) { this.fail('Voice counting is falling behind. Pause and retry.'); return; }
    this.runDecode();
  }

  private runDecode() {
    if (this.decodeWork || !this.running) return;
    const token = this.token;
    this.decodeWork = (async () => {
      while (this.running && token === this.token && this.transcriptionQueue.length) {
        this.job = this.models!.transcribe(this.transcriptionQueue.shift()!);
        this.decodeDeadline = setTimeout(() => this.fail('Voice recognition took too long. Pause and retry.'), 30000);
        const result = await this.job.promise;
        if (this.decodeDeadline) clearTimeout(this.decodeDeadline);
        this.decodeDeadline = null;
        this.job = null;
        if (!this.running || token !== this.token) return;
        if (!result.isAborted) {
          const count = countPhrases(result.result);
          this.diagnostics.decodedUtterances++;
          this.diagnostics.recognized = result.result.slice(0, 240);
          this.diagnostics.matches = count;
          this.publishDiagnostics(true);
          if (count) this.detect?.(count);
        }
      }
    })().catch(() => { if (this.running && token === this.token) this.fail('Offline voice recognition failed. Retry or count manually.'); })
      .finally(() => {
        if (this.decodeDeadline) clearTimeout(this.decodeDeadline);
        this.decodeDeadline = null;
        this.job = null; this.decodeWork = null;
        if (this.running && this.transcriptionQueue.length) this.runDecode();
      });
  }

  private fail(message: string) {
    if (!this.running) return;
    const callback = this.error;
    void this.stop().catch(() => {});
    callback?.(message);
  }

  private publishDiagnostics(force = false) {
    if (!this.running || !this.report) return;
    const now = Date.now();
    if (!force && now - this.lastDiagnostic < 500) return;
    this.lastDiagnostic = now;
    // In-memory feedback only: never store or log audio/transcripts.
    this.report({ ...this.diagnostics });
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.running = false;
    this.audioState?.(false);
    this.startup?.reject(new Error('Microphone stopped.')); this.startup = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.decodeDeadline) clearTimeout(this.decodeDeadline);
    this.decodeDeadline = null;
    this.unsubscribe?.(); this.unsubscribe = null;
    this.pending = new Float32Array(0); this.vadQueue = []; this.utterance = [];
    this.preRoll = null; this.silenceWindows = 0; this.speechWindows = 0;
    this.transcriptionQueue = [];
    this.detect = null; this.error = null; this.audioState = null;
    this.stopping = (async () => {
      // Stop capture even if the decoder is slow. Await native abort before reuse.
      const results = await Promise.allSettled([this.capture.stop(), this.job?.stop()]);
      await Promise.allSettled([this.vadWork, this.decodeWork]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    })().finally(() => { this.stopping = null; });
    return this.stopping;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    try { await this.stop(); }
    finally {
      if (this.loading) await this.loading.catch(() => {});
      await this.models?.release(); this.models = null;
    }
  }
}
