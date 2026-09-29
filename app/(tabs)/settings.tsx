import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Wirdd</Text>
      <View style={styles.card}>
        <Text style={styles.label}>TESTER EDITION</Text>
        <Text style={styles.body}>
          Astaghfirullah counting is available without an account or purchase.
          Paid features and checkout are unavailable while billing is reviewed.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>MICROPHONE & PRIVACY</Text>
        <Text style={styles.body}>
          Wirdd requests Android on-device Arabic speech recognition during a
          voice session. It receives text results in memory and saves only
          count events, session times, and an optional mood in local SQLite.
          Wirdd does not record raw audio or save transcripts. An installed
          Arabic offline model is required for voice counting; if unavailable,
          use manual counting. No account or app server is used in this edition.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>TESTING & SUPPORT</Text>
        <Text style={styles.body}>
          Recognition accuracy, lock screen continuity, earbuds, and device
          interruptions still need physical Android verification. If counting
          stops, pause and retry or use manual counting. Send feedback to the
          person who invited you to test Wirdd.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  heading: { fontFamily: Fonts.display, fontSize: 34, color: Colors.gold },
  card: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: 16, padding: 20 },
  label: { fontFamily: Fonts.uiMedium, color: Colors.gold, fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
  body: { fontFamily: Fonts.ui, color: Colors.textSecondary, fontSize: 15, lineHeight: 23 },
});
