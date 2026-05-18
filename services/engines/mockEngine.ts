import { VoiceDetectionEngine } from './voiceDetectionEngine'

export class MockEngine implements VoiceDetectionEngine {
  private onDetection: (() => void) | null = null
  private interval: ReturnType<typeof setInterval> | null = null

  async initialize(): Promise<void> {}

  async start(onDetection: () => void): Promise<void> {
    this.onDetection = onDetection
    // fire every 3s so devs can see the counter increment in emulator
    this.interval = setInterval(() => this.onDetection?.(), 3000)
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.onDetection = null
  }

  async destroy(): Promise<void> {
    await this.stop()
  }
}
