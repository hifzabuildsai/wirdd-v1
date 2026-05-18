import { Platform } from 'react-native'
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition'
import { VoiceDetectionEngine } from './voiceDetectionEngine'

const ASTAGHFIRULLAH_VARIANTS = [
  'astaghfirullah',
  'astaghfirullahal',
  'astaghfirullahal azeem',
  'astghfirullah',
  'astagfirullah',
  'استغفر الله',
  'أستغفر الله',
  'استغفرالله',
]

const DEBOUNCE_MS = 1500
const RESTART_DELAY_MS = 300

export class AndroidSpeechEngine implements VoiceDetectionEngine {
  private onDetection: (() => void) | null = null
  private isRunning = false
  private lastDetectionTime = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private subscriptions: { remove(): void }[] = []

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('AndroidSpeechEngine is Android only')
    }
  }

  async start(onDetection: () => void): Promise<void> {
    this.onDetection = onDetection
    this.isRunning = true

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('result', this.handleResults),
      ExpoSpeechRecognitionModule.addListener('error', this.handleError),
      ExpoSpeechRecognitionModule.addListener('end', this.handleEnd),
    )

    await this.startListening()
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.onDetection = null
    this.clearRestartTimer()
    this.removeSubscriptions()
    try {
      ExpoSpeechRecognitionModule.abort()
    } catch (e) {
      // ignore
    }
  }

  async destroy(): Promise<void> {
    await this.stop()
  }

  private startListening = async () => {
    if (!this.isRunning) return
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'ar-SA',
        interimResults: false,
        continuous: false,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 500,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
        },
      })
    } catch (e) {
      console.warn('[AndroidSpeechEngine] start error:', e)
      if (this.isRunning) {
        this.restartTimer = setTimeout(this.startListening, 1000)
      }
    }
  }

  private handleResults = (event: ExpoSpeechRecognitionResultEvent) => {
    if (!this.isRunning || !this.onDetection) return

    const matched = event.results.some(r => this.isMatch(r.transcript))

    if (matched) {
      const now = Date.now()
      if (now - this.lastDetectionTime >= DEBOUNCE_MS) {
        this.lastDetectionTime = now
        this.onDetection()
      }
    }

    if (this.isRunning) {
      this.restartTimer = setTimeout(this.startListening, RESTART_DELAY_MS)
    }
  }

  private handleError = (event: ExpoSpeechRecognitionErrorEvent) => {
    if (!this.isRunning) return
    // "no-speech" / "aborted" — not real errors, just restart
    const delay = event.error === 'network' ? 2000 : 400
    this.restartTimer = setTimeout(this.startListening, delay)
  }

  private handleEnd = () => {
    if (this.isRunning) {
      this.restartTimer = setTimeout(this.startListening, RESTART_DELAY_MS)
    }
  }

  private isMatch = (transcript: string): boolean => {
    if (!transcript) return false
    const normalized = transcript.toLowerCase().trim()
    return ASTAGHFIRULLAH_VARIANTS.some(v => normalized.includes(v.toLowerCase()))
  }

  private clearRestartTimer() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  private removeSubscriptions() {
    for (const sub of this.subscriptions) sub.remove()
    this.subscriptions = []
  }
}
