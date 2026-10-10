import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { deleteLocalHistory } from '@/services/database';
import { useSessionStore } from '@/stores/sessionStore';

export default function SettingsScreen() {
  const [notice, setNotice] = useState<string | null>(null);
  const isActive = useSessionStore(state => state.isActive);

  async function openSettings() {
    try { await Linking.openSettings(); }
    catch { setNotice('Open Android Settings → Apps → Wirdd → Permissions or Notifications.'); }
  }

  function confirmDelete() {
    if (useSessionStore.getState().isActive) {
      setNotice('End your session before deleting history.');
      return;
    }
    Alert.alert('Delete all local history?', 'This permanently removes your counts, sessions and moods. There is no cloud backup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete history', style: 'destructive', onPress: () => {
        try {
          deleteLocalHistory();
          useSessionStore.setState({ count: 0 });
          setNotice('Local history deleted.');
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not delete history. Please retry.'); }
      } },
    ]);
  }

  async function openSupport() {
    try { await Linking.openURL('https://github.com/hifzabuildsai/wirdd-v1/issues'); }
    catch { setNotice('Support: github.com/hifzabuildsai/wirdd-v1/issues'); }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Wirdd</Text>
      <Text style={styles.body}>Version {Constants.expoConfig?.version ?? '1.0.0'} · Android beta</Text>
      {notice && <Text style={styles.body} accessibilityRole="alert">{notice}</Text>}
      <View style={styles.card}>
        <Text style={styles.label}>VOICE & PERMISSIONS</Text>
        <Text style={styles.body}>Voice counting requires Android 13+ and an installed Arabic on-device speech model. Manual counting is available without microphone access.</Text>
        <Text style={styles.body}>If Arabic recognition is unavailable, check your phone’s speech service settings for an Arabic offline model. Model availability varies by device. Retry voice counting in airplane mode after setup.</Text>
        <Pressable style={styles.button} onPress={openSettings} accessibilityRole="button">
          <Text style={styles.buttonText}>Microphone & notification settings</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>PRIVACY & LOCAL DATA</Text>
        <Text style={styles.body}>Wirdd processes speech results in memory and saves counts, session times and optional moods on this phone. It does not save raw audio or transcripts, and has no account or app backend.</Text>
        <Text style={styles.body}>Your history has no cloud backup. Uninstalling Wirdd or clearing its app data removes it. Microphone use stops when you pause or end a voice session.</Text>
        <Pressable style={styles.button} onPress={confirmDelete} disabled={isActive} accessibilityRole="button" accessibilityState={{ disabled: isActive }}>
          <Text style={styles.buttonText}>{isActive ? 'End session to delete history' : 'Delete all local history'}</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>BETA & SUPPORT</Text>
        <Text style={styles.body}>Keep Wirdd open for voice counting. Backgrounding the app or locking the screen pauses voice; return and tap Resume. Voice accuracy still needs physical device verification. Correct missed or extra counts with +1 and −1. If voice stops, pause and retry or end the session and count manually.</Text>
        <Pressable style={styles.button} onPress={openSupport} accessibilityRole="link">
          <Text style={styles.buttonText}>Report a problem</Text>
        </Pressable>
        <Text style={styles.body}>Include your phone model, Android version, app version and steps to reproduce. Avoid sharing private audio or personal information in public reports.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  heading: { fontFamily: Fonts.display, fontSize: 34, color: Colors.gold },
  card: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: 16, padding: 20, gap: 12 },
  label: { fontFamily: Fonts.uiMedium, color: Colors.gold, fontSize: 11, letterSpacing: 1.5 },
  body: { fontFamily: Fonts.ui, color: Colors.textSecondary, fontSize: 15, lineHeight: 23 },
  button: { minHeight: 48, justifyContent: 'center', paddingVertical: 12 },
  buttonText: { fontFamily: Fonts.uiMedium, color: Colors.gold, fontSize: 15 },
});
