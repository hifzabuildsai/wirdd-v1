import { useRef, useEffect, useCallback } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import { AndroidSpeechEngine } from '../services/engines/androidSpeechEngine'
import { VoiceDetectionEngine } from '../services/engines/voiceDetectionEngine'

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message: 'Wirdd needs your microphone to detect Astaghfirullah.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  )
  return result === PermissionsAndroid.RESULTS.GRANTED
}

export function useVoiceDetection(onDetect: () => void) {
  const engineRef = useRef<VoiceDetectionEngine>(new AndroidSpeechEngine())
  const isRunningRef = useRef(false)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const start = useCallback(async () => {
    if (isRunningRef.current) return

    const granted = await requestMicPermission()
    if (!granted) {
      console.warn('[Wirdd] Microphone permission denied')
      return
    }

    try {
      await engineRef.current.initialize()
      await engineRef.current.start(() => onDetectRef.current())
      isRunningRef.current = true
    } catch (err) {
      console.error('[useVoiceDetection] start failed', err)
    }
  }, [])

  const stop = useCallback(async () => {
    if (!isRunningRef.current) return
    isRunningRef.current = false
    try {
      await engineRef.current.stop()
    } catch (err) {
      console.error('[useVoiceDetection] stop failed', err)
    }
  }, [])

  const pause = useCallback(async () => {
    if (!isRunningRef.current) return
    isRunningRef.current = false
    try {
      await engineRef.current.stop()
    } catch (err) {
      console.error('[useVoiceDetection] pause failed', err)
    }
  }, [])

  const resume = useCallback(async () => {
    if (isRunningRef.current) return
    try {
      await engineRef.current.start(() => onDetectRef.current())
      isRunningRef.current = true
    } catch (err) {
      console.error('[useVoiceDetection] resume failed', err)
    }
  }, [])

  useEffect(() => {
    return () => {
      isRunningRef.current = false
      engineRef.current.destroy().catch(() => {})
    }
  }, [])

  return { start, stop, pause, resume }
}
