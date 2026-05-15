import { useRef, useEffect, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { PorcupineManager } from '@picovoice/porcupine-react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

import { PORCUPINE_ACCESS_KEY, KEYWORD_ASSET } from '@/constants/porcupine';

const DEBOUNCE_MS = 1500;

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message: 'Wirdd needs your microphone to detect Astaghfirullah.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useVoiceDetection(onDetect: () => void) {
  const porcupineRef = useRef<PorcupineManager | null>(null);
  const sessionActiveRef = useRef(false);
  const lastDetectionRef = useRef(0);
  // mirror onDetect so handleDetection stays stable with no deps
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const handleDetection = useCallback(() => {
    if (!sessionActiveRef.current) return; // ghost-detection guard
    const now = Date.now();
    if (now - lastDetectionRef.current < DEBOUNCE_MS) return; // debounce
    lastDetectionRef.current = now;
    onDetectRef.current();
  }, []);

  const start = useCallback(async () => {
    if (porcupineRef.current) return; // singleton guard

    if (!PORCUPINE_ACCESS_KEY || KEYWORD_ASSET === null) {
      console.warn('[Wirdd] Porcupine not configured — add key + .ppn to constants/porcupine.ts');
      sessionActiveRef.current = true;
      return;
    }

    const granted = await requestMicPermission();
    if (!granted) {
      console.warn('[Wirdd] Microphone permission denied');
      return;
    }

    try {
      const asset = Asset.fromModule(KEYWORD_ASSET);
      await asset.downloadAsync();
      const dest = `${FileSystem.cacheDirectory}astaghfirullah_android.ppn`;
      await FileSystem.copyAsync({ from: asset.localUri!, to: dest });

      porcupineRef.current = await PorcupineManager.fromKeywordPaths(
        PORCUPINE_ACCESS_KEY,
        [dest],
        () => handleDetection(),
        (error) => console.error('[Porcupine]', error),
      );
      sessionActiveRef.current = true;
      await porcupineRef.current.start();
    } catch (err) {
      console.error('[useVoiceDetection] start failed', err);
      porcupineRef.current = null;
    }
  }, [handleDetection]);

  const stop = useCallback(async () => {
    sessionActiveRef.current = false; // set before async teardown — drops in-flight callbacks
    if (!porcupineRef.current) return;
    try {
      await porcupineRef.current.stop();
      porcupineRef.current.delete(); // synchronous in v4
    } catch (err) {
      console.error('[useVoiceDetection] stop failed', err);
    } finally {
      porcupineRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      // fire-and-forget cleanup on unmount
      if (porcupineRef.current) {
        porcupineRef.current.stop().then(() => {
          porcupineRef.current?.delete();
          porcupineRef.current = null;
        });
      }
    };
  }, []);

  return { start, stop };
}
