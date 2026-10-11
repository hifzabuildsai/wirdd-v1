import { useRef, useEffect, useCallback, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { WhisperEngine } from '../services/engines/whisperEngine';
import type { VoiceDetectionEngine } from '../services/engines/voiceDetectionEngine';
import { emptyDiagnostics } from '../services/engines/offlineEngine';
import { foregroundPermission } from '../services/engines/foregroundPermission';

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
  const [diagnostics, setDiagnostics] = useState(emptyDiagnostics);
  const engineRef = useRef<VoiceDetectionEngine | null>(null);
  if (!engineRef.current) engineRef.current = new WhisperEngine(setDiagnostics);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const pendingRef = useRef<Promise<void> | null>(null);
  const permissionPromptRef = useRef(false);
  const isRequestingPermission = useCallback(() => permissionPromptRef.current, []);
  const [listening, setListening] = useState(false);
  const detectRef = useRef(onDetect);
  const errorRef = useRef(onError);
  detectRef.current = onDetect;
  errorRef.current = onError;

  const begin = useCallback((check: boolean) => {
    if (pendingRef.current) return pendingRef.current;
    if (runningRef.current) return Promise.resolve();
    const generation = ++generationRef.current;
    const ensureCurrent = () => {
      if (generation !== generationRef.current) throw new Error('Microphone start cancelled.');
      if (AppState.currentState !== 'active') throw new Error('Keep Wirdd open to start voice counting.');
    };
    const operation = (async () => {
      await foregroundPermission(requestMicPermission, value => { permissionPromptRef.current = value; }, ensureCurrent);
      await engineRef.current!.initialize();
      ensureCurrent();
      let failedDuringStartup = false;
      const fail = (message: string) => { failedDuringStartup = true; runningRef.current = false; errorRef.current(message); };
      const audioState = (value: boolean) => { if (generation === generationRef.current) setListening(value); };
      if (check) {
        if (!engineRef.current!.check) throw new Error('Voice check is unavailable.');
        await engineRef.current!.check(fail, audioState);
      } else {
        await engineRef.current!.start(count => detectRef.current(count), fail, audioState);
      }
      ensureCurrent();
      if (failedDuringStartup) throw new Error('Microphone stopped during startup. Retry the session.');
      runningRef.current = !check;
    })();
    pendingRef.current = operation;
    void operation.finally(() => { pendingRef.current = null; }).catch(() => {});
    return operation;
  }, []);
  const start = useCallback(() => begin(false), [begin]);
  const check = useCallback(() => begin(true), [begin]);

  const stop = useCallback(async () => {
    generationRef.current++;
    runningRef.current = false;
    setListening(false);
    await engineRef.current!.stop();
    setDiagnostics(emptyDiagnostics());
  }, []);

  const pause = stop;
  const resume = start;

  useEffect(() => () => {
    generationRef.current++;
    runningRef.current = false;
    void engineRef.current!.destroy();
  }, []);

  return { start, stop, pause, resume, check, listening, diagnostics, isRequestingPermission };
}
