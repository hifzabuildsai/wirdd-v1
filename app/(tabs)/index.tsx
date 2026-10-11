import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSessionStore } from '@/stores/sessionStore';
import { useVoiceDetection } from '@/hooks/useVoiceDetection';
import { CounterCircle } from '@/components/session/CounterCircle';
import { ListeningIndicator } from '@/components/session/ListeningIndicator';
import { ShockwaveRing } from '@/components/session/ShockwaveRing';
import { BreathingRing } from '@/components/session/BreathingRing';
import { updateSessionMood } from '@/services/database';
import {
  startForegroundService,
  stopForegroundService,
  requestNotificationUpdate,
  setNotificationPaused,
} from '@/services/foregroundService';

// ── Mood options ───────────────────────────────────────────────────────────

const MOODS = [
  { emoji: '😔', label: 'Distracted', key: 'distracted' },
  { emoji: '😐', label: 'Present',    key: 'present'    },
  { emoji: '🤍', label: 'Connected',  key: 'connected'  },
] as const;

// ── Screen ─────────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const voiceSupported = Platform.OS === 'android';
  const router = useRouter();
  const {
    isActive,
    isPaused,
    count,
    mode,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    increment,
    decrement,
  } = useSessionStore();
  const detectionSignal = useSharedValue(0);

  const [moodVisible, setMoodVisible] = useState(false);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceCheck, setVoiceCheck] = useState(false);
  const manual = mode === 'manual';
  const startingRef = useRef(false);
  const bufferedRef = useRef(0);
  const startupErrorRef = useRef<string | null>(null);
  const stopVoiceRef = useRef<(() => Promise<void>) | null>(null);

  const handleDetect = useCallback((detected: number) => {
    if (startingRef.current) { bufferedRef.current += detected; return; }
    if (!useSessionStore.getState().isActive) {
      return;
    }
    try {
      for (let i = 0; i < detected; i++) {
        if (!useSessionStore.getState().isPaused) {
          increment();
          detectionSignal.value = detectionSignal.value + 1;
        }
      }
      requestNotificationUpdate(useSessionStore.getState().count);
    } catch {
      pauseSession();
      void stopVoiceRef.current?.();
      void stopForegroundService().catch(() => {});
      setError('Could not save a count. Microphone paused; check storage and retry.');
    }
  }, [increment, pauseSession, detectionSignal]);

  const handleVoiceError = useCallback((message: string) => {
    startupErrorRef.current = message;
    setError(message);
    pauseSession();
    void stopVoiceRef.current?.().catch(() => {});
    void stopForegroundService().catch(() => {});
  }, [pauseSession]);
  const { start, stop, pause, resume, check, listening, diagnostics, isRequestingPermission } = useVoiceDetection(handleDetect, handleVoiceError);
  stopVoiceRef.current = stop;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' || manual) return;
      if (isRequestingPermission()) return;
      const session = useSessionStore.getState();
      if (!session.isActive && !startingRef.current) return;
      startupErrorRef.current = 'Voice paused when Wirdd left the foreground.';
      pauseSession();
      void stop().catch(() => {});
      void stopForegroundService().catch(() => {});
      setNotice('Voice paused because the app was backgrounded or the screen locked. Return here and tap Resume.');
    });
    return () => { subscription.remove(); };
  }, [manual, pauseSession, stop, isRequestingPermission]);

  useEffect(() => () => {
    // A surviving store session must not claim its destroyed engine is running.
    useSessionStore.getState().pauseSession();
    void stopForegroundService().catch(() => {});
  }, []);

  const handleStart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    startingRef.current = true;
    bufferedRef.current = 0;
    startupErrorRef.current = null;
    try {
      await start();
      if (AppState.currentState !== 'active') throw new Error('Keep Wirdd open to start voice counting.');
      if (startupErrorRef.current) throw new Error(startupErrorRef.current);
      const notificationVisible = await startForegroundService(0);
      if (AppState.currentState !== 'active') throw new Error('Keep Wirdd open to start voice counting.');
      if (startupErrorRef.current) throw new Error(startupErrorRef.current);
      startSession();
      startingRef.current = false;
      setNotice(notificationVisible ? 'Keep Wirdd open. Voice pauses when the app is backgrounded or the screen locks.' : 'Notifications are off. Keep Wirdd open; voice pauses in the background or when the screen locks.');
      if (bufferedRef.current > 0) handleDetect(bufferedRef.current);
    } catch (cause) {
      await stop().catch(() => {});
      await stopForegroundService().catch(() => {});
      setError(cause instanceof Error ? cause.message : 'Microphone failed to start.');
    } finally {
      startingRef.current = false;
      bufferedRef.current = 0;
      setBusy(false);
    }
  }, [busy, startSession, start, stop, handleDetect]);

  const handleManualStart = useCallback(() => {
    if (busy) return;
    setError(null);
    setNotice(null);
    try {
      startSession('manual');
    } catch {
      setError('Could not save a session. Check available storage and retry.');
    }
  }, [busy, startSession]);

  const handleCheck = useCallback(async () => {
    if (busy || (isActive && !isPaused)) return;
    setBusy(true); setError(null); setNotice(null);
    startingRef.current = true;
    try { await check(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Voice check failed.'); }
    finally { startingRef.current = false; setBusy(false); }
  }, [busy, isActive, isPaused, check]);

  const onePhraseCheck = <View>
    <Pressable onPress={handleCheck} disabled={busy} accessibilityRole="button" accessibilityLabel="Check one recitation for six seconds">
      <Text style={styles.stateLabel}>{busy ? 'Preparing or checking…' : 'Check one recitation (6 seconds)'}</Text>
    </Pressable>
    <Text style={styles.stateLabel}>{diagnostics.checkState === 'recording'
      ? `Say Astaghfirullah once now · ${Math.max(0, 6 - diagnostics.audioSeconds).toFixed(0)}s left`
      : diagnostics.checkState === 'decoding' ? 'Microphone off · recognizing the whole sample…'
      : diagnostics.checkState === 'complete' ? 'Check complete · microphone off'
      : 'Wait for “Say now”, recite once, then stay quiet. This check adds no counts.'}</Text>
    {diagnostics.checkState !== 'idle' && <>
      <Text style={styles.stateLabel}>Sample: {diagnostics.utteranceSeconds.toFixed(1)}s · Peak sound level: {(diagnostics.peakLevel * 100).toFixed(2)}%</Text>
      <Text style={styles.stateLabel}>Last recognized: {diagnostics.recognized || 'None yet'} · Phrase matches: {diagnostics.matches}</Text>
      <Text style={styles.stateLabel}>Audio and recognized text are not saved.</Text>
    </>}
  </View>;

  const handlePauseResume = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    startupErrorRef.current = null;
    try {
      if (isPaused) {
        if (!manual) {
          startingRef.current = true;
          bufferedRef.current = 0;
          await resume();
          if (AppState.currentState !== 'active') throw new Error('Keep Wirdd open to resume voice counting.');
          if (startupErrorRef.current) throw new Error(startupErrorRef.current);
          await startForegroundService(useSessionStore.getState().count);
          if (startupErrorRef.current || AppState.currentState !== 'active') throw new Error('Voice paused during resume. Keep Wirdd open and retry.');
        }
        resumeSession();
        startingRef.current = false;
        if (bufferedRef.current > 0) handleDetect(bufferedRef.current);
        setError(null);
        if (!manual) setNotice('Keep Wirdd open. Voice pauses when the app is backgrounded or the screen locks.');
      } else {
        if (!manual) await pause();
        pauseSession();
        await stopForegroundService();
      }
    } catch (cause) {
      await stop().catch(() => {});
      pauseSession();
      await stopForegroundService().catch(() => {});
      setError(cause instanceof Error ? cause.message : 'Microphone could not resume.');
    } finally {
      startingRef.current = false;
      bufferedRef.current = 0;
      setBusy(false);
    }
  }, [busy, isPaused, manual, pause, resume, stop, pauseSession, resumeSession, handleDetect]);

  const handleStop = useCallback(async () => {
    if (busy) return;
    // Capture localId before stopSession() resets it to null
    const sessionLocalId = useSessionStore.getState().localId;
    setBusy(true);
    try {
      try { await stop(); } catch { /* The saved count is still valid. */ }
      stopSession();
      if (sessionLocalId) {
        setPendingLocalId(sessionLocalId);
        setMoodVisible(true);
      }
    } catch (cause) {
      pauseSession();
      setError(cause instanceof Error ? cause.message : 'Could not save the session. Try ending it again.');
    } finally {
      await stopForegroundService().catch(() => {});
      setBusy(false);
    }
  }, [busy, stop, stopSession, pauseSession]);

  const handleManualIncrement = useCallback(() => {
    handleDetect(1);
    if (isPaused) void setNotificationPaused(useSessionStore.getState().count, true).catch(() => {});
  }, [handleDetect, isPaused]);

  const handleCorrection = useCallback(() => {
    try {
      decrement();
      void setNotificationPaused(useSessionStore.getState().count, isPaused).catch(() => {});
    } catch {
      setError('Could not save the correction. Check storage and retry.');
    }
  }, [decrement, isPaused]);

  function handleMoodSelect(mood: string | null) {
    if (mood && pendingLocalId) {
      try { updateSessionMood(pendingLocalId, mood); }
      catch {
        setError('Session saved, but the mood could not be saved. Retry or skip.');
        return;
      }
    }
    setMoodVisible(false);
    setPendingLocalId(null);
    router.navigate('/dashboard');
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {isActive ? (
        <View style={styles.activeContainer}>
          <View style={styles.counterWrap}>
            <BreathingRing />
            <ShockwaveRing detectionSignal={detectionSignal} />
            <CounterCircle count={count} detectionSignal={detectionSignal} />
          </View>

          {!manual && !isPaused && !error && listening ? <View accessibilityLabel="Microphone listening"><ListeningIndicator /><Text style={styles.stateLabel}>Microphone listening</Text></View> : (
            <Text style={styles.stateLabel}>{manual ? 'Manual counting' : isPaused ? 'Paused · microphone off' : error ? 'Microphone unavailable' : 'Reconnecting microphone…'}</Text>
          )}
          {error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
          {notice && <Text style={styles.stateLabel} accessibilityRole="alert">{notice}</Text>}
          {!manual && <>
            <Pressable onPress={() => setVoiceCheck(value => !value)} accessibilityRole="button" accessibilityLabel="Toggle voice check" accessibilityState={{ expanded: voiceCheck }}>
              <Text style={styles.stateLabel}>{voiceCheck ? 'Hide voice check' : 'Voice check'}</Text>
            </Pressable>
            {voiceCheck && <View>
              <Text style={styles.stateLabel}>Audio received: {diagnostics.audioSeconds.toFixed(1)}s · Sound level: {(diagnostics.level * 100).toFixed(2)}%</Text>
              <Text style={styles.stateLabel}>Speech windows: {diagnostics.speechWindows} · Recognitions: {diagnostics.decodedUtterances}</Text>
              <Text style={styles.stateLabel}>Last sample: {diagnostics.utteranceSeconds.toFixed(1)}s · Peak sound level: {(diagnostics.peakLevel * 100).toFixed(2)}%</Text>
              <Text style={styles.stateLabel}>Last recognized: {diagnostics.recognized || 'None yet'} · Phrase matches: {diagnostics.matches}</Text>
              <Text style={styles.stateLabel}>Live check only. Audio and recognized text are not saved.</Text>
              {isPaused && onePhraseCheck}
            </View>}
          </>}

          <View style={styles.actionRow}>
            <Pressable style={styles.plusButton} onPress={handleManualIncrement} disabled={isPaused || busy} accessibilityRole="button" accessibilityLabel="Add one count">
              <Text style={styles.plusLabel}>+1</Text>
            </Pressable>
            <Pressable style={styles.plusButton} onPress={handleCorrection} disabled={count === 0 || busy} accessibilityRole="button" accessibilityLabel="Remove one extra count">
              <Text style={styles.plusLabel}>−1</Text>
            </Pressable>
            <Pressable style={styles.stopButton} onPress={handlePauseResume} disabled={busy} accessibilityRole="button" accessibilityLabel={isPaused ? 'Resume session' : 'Pause session'}>
              <Text style={styles.stopLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
            <Pressable style={styles.stopButton} onPress={handleStop} disabled={busy} accessibilityRole="button" accessibilityLabel="End and save session">
              <Ionicons name="stop-circle-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.stopLabel}>Stop</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.idleContainer}>
          <Text style={styles.arabicPhrase}>أَسْتَغْفِرُ اللّٰه</Text>
          <Text style={styles.latinPhrase}>Astaghfirullah</Text>
          <Pressable style={[styles.startButton, !voiceSupported && { opacity: 0.4 }]} onPress={handleStart} disabled={busy || !voiceSupported} accessibilityRole="button" accessibilityLabel="Start voice session" accessibilityState={{ disabled: busy || !voiceSupported }}>
            <Ionicons name="mic" size={30} color={Colors.background} />
          </Pressable>
          <Text style={styles.startHint}>{busy ? 'Preparing offline voice…' : voiceSupported ? 'Tap to start offline voice · beta' : 'Voice requires Android · count manually below'}</Text>
          {voiceSupported && <Text style={styles.stateLabel}>Recite clearly, then pause briefly. Counts may take a few seconds.</Text>}
          {error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
          <Pressable onPress={handleManualStart} disabled={busy} accessibilityRole="button" accessibilityLabel="Start manual count">
            <Text style={styles.stateLabel}>Count manually instead</Text>
          </Pressable>
          {voiceSupported && onePhraseCheck}
        </View>
      )}

      {/* ── Mood modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={moodVisible}
        animationType="slide"
        transparent
        onRequestClose={() => handleMoodSelect(null)}
      >
        <Pressable style={modal.overlay} onPress={() => handleMoodSelect(null)}>
          <Pressable style={modal.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={modal.header}>
              <Text style={modal.question}>How was your heart?</Text>
              <Pressable onPress={() => handleMoodSelect(null)} hitSlop={12}>
                <Text style={modal.skip}>Skip</Text>
              </Pressable>
            </View>
            {error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}

            {MOODS.map(({ emoji, label, key }) => (
              <Pressable key={key} style={modal.row} onPress={() => handleMoodSelect(key)}>
                <Text style={modal.emoji}>{emoji}</Text>
                <Text style={modal.label}>{label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },

  // ── Active state ─────────────────────────────────────────────────────────
  activeContainer: {
    alignItems: 'center',
    gap: 24,
    maxWidth: '100%',
  },
  counterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  stateLabel: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  errorText: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.gold,
    textAlign: 'center',
    maxWidth: 300,
  },
  plusButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  plusLabel: {
    fontFamily: Fonts.uiMedium,
    fontSize: 14,
    color: Colors.gold,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stopLabel: {
    fontFamily: Fonts.uiMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // ── Idle state ────────────────────────────────────────────────────────────
  idleContainer: {
    alignItems: 'center',
    gap: 12,
  },
  arabicPhrase: {
    fontFamily: Fonts.arabic,
    fontSize: 38,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  latinPhrase: {
    fontFamily: Fonts.displayLight,
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 2.5,
    marginBottom: 28,
  },
  startButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startHint: {
    fontFamily: Fonts.ui,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  question: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  skip: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    fontFamily: Fonts.uiMedium,
    fontSize: 17,
    color: Colors.textPrimary,
  },
});
