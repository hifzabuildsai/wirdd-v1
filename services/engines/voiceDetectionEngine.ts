export interface VoiceDetectionEngine {
  initialize(): Promise<void>
  start(onDetection: (count: number) => void, onError: (message: string) => void): Promise<void>
  stop(): Promise<void>
  destroy(): Promise<void>
}
