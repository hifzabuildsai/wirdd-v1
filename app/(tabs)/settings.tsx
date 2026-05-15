import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Settings</Text>
      <Text style={styles.hint}>Profile · pro unlock · preferences</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: Fonts.displayLight,
    fontSize: 32,
    color: Colors.gold,
    letterSpacing: 2,
  },
  hint: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
