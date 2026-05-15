import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSessionStore } from '@/stores/sessionStore';
import { useVoiceDetection } from '@/hooks/useVoiceDetection';
import { CounterCircle } from '@/components/session/CounterCircle';
import { ListeningIndicator } from '@/components/session/ListeningIndicator';
import { ShockwaveRing } from '@/components/session/ShockwaveRing';

export default function SessionScreen() {
  const { isActive, count, startSession, stopSession, increment } = useSessionStore();
  const detectionSignal = useSharedValue(0);

  const handleDetect = useCallback(() => {
    increment();
    detectionSignal.value = detectionSignal.value + 1;
  }, [increment, detectionSignal]);

  const { start, stop } = useVoiceDetection(handleDetect);

  const handleStart = useCallback(async () => {
    startSession();
    await start();
  }, [startSession, start]);

  const handleStop = useCallback(async () => {
    await stop();
    stopSession();
  }, [stop, stopSession]);

  return (
    <View style={styles.container}>
      {isActive ? (
        <View style={styles.activeContainer}>
          <View style={styles.counterWrap}>
            <ShockwaveRing detectionSignal={detectionSignal} />
            <CounterCircle count={count} detectionSignal={detectionSignal} />
          </View>

          <ListeningIndicator />

          <Pressable style={styles.stopButton} onPress={handleStop}>
            <Ionicons name="stop-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.stopLabel}>Stop</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.idleContainer}>
          <Text style={styles.arabicPhrase}>أَسْتَغْفِرُ اللّٰه</Text>
          <Text style={styles.latinPhrase}>Astaghfirullah</Text>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Ionicons name="mic" size={30} color={Colors.background} />
          </Pressable>
          <Text style={styles.startHint}>Tap to begin your session</Text>
        </View>
      )}
    </View>
  );
}

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
