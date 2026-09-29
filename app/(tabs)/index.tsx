import { useCallback, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
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
  const router = useRouter();
  const {
    isActive,
    isPaused,
    count,
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
  const [manual, setManual] = useState(false);
  const startingRef = useRef(false);
  const bufferedRef = useRef(0);
  const startupErrorRef = useRef<string | null>(null);
  const stopVoiceRef = useRef<(() => Promise<void>) | null>(null);

  const handleDetect = useCallback((detected: number) => {
    if (!useSessionStore.getState().isActive) {
      if (startingRef.current) bufferedRef.current += detected;
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
      void setNotificationPaused(useSessionStore.getState().count, true).catch(() => {});
      setError('Could not save a count. Microphone paused; check storage and retry.');
    }
  }, [increment, pauseSession, detectionSignal]);

  const handleVoiceError = useCallback((message: string) => {
    if (startingRef.current) startupErrorRef.current = message;
    setError(message);
    pauseSession();
    void setNotificationPaused(useSessionStore.getState().count, true).catch(() => {});
  }, [pauseSession]);
  const { start, stop, pause, resume, listening } = useVoiceDetection(handleDetect, handleVoiceError);
  stopVoiceRef.current = stop;

  const handleStart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    startingRef.current = true;
    bufferedRef.current = 0;
    startupErrorRef.current = null;
    try {
      await start();
      if (startupErrorRef.current) throw new Error(startupErrorRef.current);
      await startForegroundService(0);
      if (startupErrorRef.current) throw new Error(startupErrorRef.current);
      startSession();
      startingRef.current = false;
      setManual(false);
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
    try {
      startSession();
      setManual(true);
    } catch {
      setError('Could not save a session. Check available storage and retry.');
    }
  }, [busy, startSession]);

  const handlePauseResume = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isPaused) {
        if (!manual) await resume();
        resumeSession();
        await setNotificationPaused(useSessionStore.getState().count, false);
        setError(null);
      } else {
        if (!manual) await pause();
        pauseSession();
        await setNotificationPaused(useSessionStore.getState().count, true);
      }
    } catch (cause) {
      pauseSession();
      setError(cause instanceof Error ? cause.message : 'Microphone could not resume.');
    } finally {
      setBusy(false);
    }
  }, [busy, isPaused, manual, pause, resume, pauseSession, resumeSession]);

  const handleStop = useCallback(async () => {
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
      setError(cause instanceof Error ? cause.message : 'Could not save the session. Try ending it again.');
    } finally {
      await stopForegroundService().catch(() => {});
      setBusy(false);
    }
  }, [stop, stopSession]);

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
      updateSessionMood(pendingLocalId, mood);
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
          <Pressable style={styles.startButton} onPress={handleStart} disabled={busy} accessibilityRole="button" accessibilityLabel="Start voice session">
            <Ionicons name="mic" size={30} color={Colors.background} />
          </Pressable>
          <Text style={styles.startHint}>{busy ? 'Starting microphone…' : 'Tap to start voice counting'}</Text>
          {error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
          <Pressable onPress={handleManualStart} disabled={busy} accessibilityRole="button" accessibilityLabel="Start manual count">
            <Text style={styles.stateLabel}>Count manually instead</Text>
          </Pressable>
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
