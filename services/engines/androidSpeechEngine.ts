import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';
import { countPhrases } from './countPhrases';
import type { VoiceDetectionEngine } from './voiceDetectionEngine';

// Fail closed rather than silently sending speech to a network recognizer.
export class AndroidSpeechEngine implements VoiceDetectionEngine {
  private running = false;
  private onDetection: ((count: number) => void) | null = null;
  private onError: ((message: string) => void) | null = null;
  private subscriptions: { remove(): void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startup: { resolve: () => void; reject: (error: Error) => void } | null = null;
  private handledResult = false;
  private failures = 0;

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') throw new Error('Voice sessions require Android.');
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable() ||
        !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      throw new Error('On-device speech recognition is unavailable on this phone. You can count manually.');
    }
    if (Platform.Version >= 33) {
      const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      if (!locales.installedLocales.some(locale => locale.toLowerCase().startsWith('ar'))) {
        throw new Error('Install an Arabic offline speech model in Android settings, then retry. You can count manually meanwhile.');
      }
    }
  }

  async start(onDetection: (count: number) => void, onError: (message: string) => void): Promise<void> {
    if (this.running) return;
    this.onDetection = onDetection;
    this.onError = onError;
    this.running = true;
    this.failures = 0;
    this.subscriptions = [
      ExpoSpeechRecognitionModule.addListener('audiostart', () => {
        this.failures = 0;
        this.startup?.resolve();
        this.startup = null;
      }),
      ExpoSpeechRecognitionModule.addListener('result', this.handleResult),
      ExpoSpeechRecognitionModule.addListener('error', this.handleError),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (this.running) this.scheduleRestart();
      }),
    ];
    try {
      await new Promise<void>((resolve, reject) => {
        this.startup = { resolve, reject };
        this.timer = setTimeout(() => {
          this.timer = null;
          this.startup?.reject(new Error('Microphone did not start. Check Android speech settings.'));
          this.startup = null;
        }, 8000);
        this.listen();
      });
      this.clearTimer();
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.clearTimer();
    this.startup?.reject(new Error('Microphone stopped.'));
    this.startup = null;
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];
    this.onDetection = null;
    this.onError = null;
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* Already stopped. */ }
  }

  async destroy(): Promise<void> { await this.stop(); }

  private listen = () => {
    if (!this.running) return;
    this.handledResult = false;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'ar-SA',
        requiresOnDeviceRecognition: true,
        interimResults: false,
        continuous: false,
      });
    } catch (error) {
      this.fatal(error instanceof Error ? error.message : 'Speech recognition failed to start.');
    }
  };

  private handleResult = (event: ExpoSpeechRecognitionResultEvent) => {
    if (!this.running || !event.isFinal || this.handledResult) return;
    this.handledResult = true;
    // Alternatives describe the same utterance; count only the first result.
    const count = countPhrases(event.results[0]?.transcript ?? '');
    if (count > 0) this.onDetection?.(count);
  };

  private handleError = (event: ExpoSpeechRecognitionErrorEvent) => {
    if (!this.running) return;
    if (event.error === 'no-speech' || event.error === 'speech-timeout' || event.error === 'aborted') return;
    if (event.error === 'busy' || event.error === 'client') {
      if (++this.failures < 3) return;
    }
    const details = event.error === 'language-not-supported'
      ? 'Arabic offline speech recognition is unavailable. Install its offline model.'
      : event.error === 'not-allowed'
        ? 'Microphone permission changed. Allow it in Android settings.'
        : `Microphone stopped: ${event.error}. Check speech settings and retry.`;
    this.fatal(details);
  };

  private fatal(message: string) {
    if (!this.running) return;
    this.startup?.reject(new Error(message));
    this.startup = null;
    this.onError?.(message);
    void this.stop();
  }

  private scheduleRestart() {
    this.clearTimer();
    this.timer = setTimeout(() => { this.timer = null; this.listen(); }, 250);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
