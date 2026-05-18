export interface VoiceDetectionEngine {
  initialize(): Promise<void>
  start(onDetection: () => void): Promise<void>
  stop(): Promise<void>
  destroy(): Promise<void>
}
