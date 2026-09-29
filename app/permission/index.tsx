import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

async function completeOnboarding(router: ReturnType<typeof useRouter>) {
  await AsyncStorage.setItem('@wirdd/onboarded', '1');
  router.replace('/(tabs)');
}

export default function PermissionScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  async function handleAllow() {
    await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    await completeOnboarding(router);
  }

  async function handleSkip() {
    await completeOnboarding(router);
  }

  function toggleExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="mic" size={80} color={Colors.gold} />
      </View>

      <Text style={styles.heading}>Wirdd needs your microphone</Text>
      <Text style={styles.body}>
        Wirdd counts during an open session. An Arabic offline speech model is required
        for automatic counting. Manual counting works without it.
      </Text>

      <Pressable style={styles.allowBtn} onPress={handleAllow}>
        <Text style={styles.allowText}>Allow microphone</Text>
      </Pressable>

      {/* How it works */}
      <Pressable style={styles.howRow} onPress={toggleExpanded}>
        <Text style={styles.howLabel}>How it works</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.howContent}>
          <Text style={styles.howText}>
            Wirdd asks Android for on-device Arabic speech recognition and reads the resulting
            text in memory to count Astaghfirullah. Wirdd does not save raw audio or transcripts.
            Voice counting stops when you pause or end a session.
          </Text>
        </View>
      )}

      <Pressable style={styles.skipLink} onPress={handleSkip}>
        <Text style={styles.skipLinkText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heading: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  allowBtn: {
    width: '100%',
    backgroundColor: Colors.gold,
    paddingVertical: 15,
    borderRadius: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  allowText: {
    fontFamily: Fonts.uiMedium,
    fontSize: 16,
    color: Colors.background,
  },

  // ── How it works ──────────────────────────────────────────────────────────
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  howLabel: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  howContent: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
  },
  howText: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  skipLink: {
    paddingVertical: 8,
    marginTop: 4,
  },
  skipLinkText: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
