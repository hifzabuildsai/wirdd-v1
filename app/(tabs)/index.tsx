import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSessionStore } from '@/stores/sessionStore';
import { useProfileStore } from '@/stores/profileStore';
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
  registerSessionCallbacks,
  clearSessionCallbacks,
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
    count,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    increment,
  } = useSessionStore();
  const { isPro } = useProfileStore();
  const detectionSignal = useSharedValue(0);

  const [moodVisible, setMoodVisible] = useState(false);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);

  // Called on every Porcupine detection
  const handleDetect = useCallback(() => {
    increment();
    detectionSignal.value = detectionSignal.value + 1;
    if (isPro) {
      // Zustand set is synchronous — getState().count reflects the post-increment value
      requestNotificationUpdate(useSessionStore.getState().count);
    }
  }, [increment, detectionSignal, isPro]);

  const { start, stop, pause, resume } = useVoiceDetection(handleDetect);

  // Stable refs so callbacks registered with foregroundService never close over stale fns
  const stopRef = useRef(stop);
  const pauseRef = useRef(pause);
  const resumeRef = useRef(resume);
  stopRef.current = stop;
  pauseRef.current = pause;
  resumeRef.current = resume;

  // Register notification action callbacks while session is active
  useEffect(() => {
    if (!isActive || !isPro) return;

    registerSessionCallbacks({
      onPause: () => {
        pauseRef.current();
        pauseSession();
      },
      onResume: () => {
        resumeRef.current();
        resumeSession();
      },
      onEnd: () => {
        stopRef.current().then(() => {
          stopSession();
          stopForegroundService();
        });
      },
    });

    return () => clearSessionCallbacks();
  }, [isActive, isPro, pauseSession, resumeSession, stopSession]);

  const handleStart = useCallback(async () => {
    startSession();
    await start();
    if (isPro) {
      await startForegroundService(0);
    }
  }, [startSession, start, isPro]);

  const handleStop = useCallback(async () => {
    // Capture localId before stopSession() resets it to null
    const sessionLocalId = useSessionStore.getState().localId;
    await stop();
    stopSession();
    if (isPro) {
      await stopForegroundService();
    }
    if (sessionLocalId) {
      setPendingLocalId(sessionLocalId);
      setMoodVisible(true);
    }
  }, [stop, stopSession, isPro]);

  const handleManualIncrement = useCallback(() => {
    increment();
    detectionSignal.value = detectionSignal.value + 1;
    if (isPro) {
      requestNotificationUpdate(useSessionStore.getState().count);
    }
  }, [increment, detectionSignal, isPro]);

  function handleMoodSelect(mood: string | null) {
    if (mood && pendingLocalId) {
      updateSessionMood(pendingLocalId, mood);
    }
    setMoodVisible(false);
    setPendingLocalId(null);
    router.navigate('/dashboard');
  }

  return (
    <View style={styles.container}>
      {isActive ? (
        <View style={styles.activeContainer}>
          <View style={styles.counterWrap}>
            <BreathingRing />
            <ShockwaveRing detectionSignal={detectionSignal} />
            <CounterCircle count={count} detectionSignal={detectionSignal} />
          </View>

          <ListeningIndicator />

          <View style={styles.actionRow}>
            <Pressable style={styles.plusButton} onPress={handleManualIncrement}>
              <Text style={styles.plusLabel}>+1</Text>
            </Pressable>
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Ionicons name="stop-circle-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.stopLabel}>Stop</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.idleContainer}>
          <Text style={styles.arabicPhrase}>أَسْتَغْفِرُ اللّٰه</Text>
          <Text style={styles.latinPhrase}>Astaghfirullah</Text>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Ionicons name="mic" size={30} color={Colors.background} />
          </Pressable>
          <Text style={styles.startHint}>Say Astaghfirullah to begin</Text>
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
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Active state ─────────────────────────────────────────────────────────
  activeContainer: {
    alignItems: 'center',
    gap: 36,
  },
  counterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
