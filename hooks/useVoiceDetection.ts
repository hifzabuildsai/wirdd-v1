import { useRef, useEffect, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { AndroidSpeechEngine } from '../services/engines/androidSpeechEngine';
import type { VoiceDetectionEngine } from '../services/engines/voiceDetectionEngine';

async function requestMicPermission(): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('Voice sessions require Android.');
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone permission',
      message: 'Wirdd uses the microphone only during a voice session.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Microphone permission denied. Allow it in Android settings or count manually.');
  }
}

export function useVoiceDetection(onDetect: (count: number) => void, onError: (message: string) => void) {
  const engineRef = useRef<VoiceDetectionEngine>(new AndroidSpeechEngine());
  const runningRef = useRef(false);
  const detectRef = useRef(onDetect);
  const errorRef = useRef(onError);
  detectRef.current = onDetect;
  errorRef.current = onError;

  const start = useCallback(async () => {
    if (runningRef.current) return;
    await requestMicPermission();
    await engineRef.current.initialize();
    let failedDuringStartup = false;
    await engineRef.current.start(
      (count) => detectRef.current(count),
      (message) => { failedDuringStartup = true; runningRef.current = false; errorRef.current(message); },
    );
    if (failedDuringStartup) throw new Error('Microphone stopped during startup. Retry the session.');
    runningRef.current = true;
  }, []);

  const stop = useCallback(async () => {
    runningRef.current = false;
    await engineRef.current.stop();
  }, []);

  const pause = stop;
  const resume = start;

  useEffect(() => () => {
    runningRef.current = false;
    void engineRef.current.destroy();
  }, []);

  return { start, stop, pause, resume };
}
