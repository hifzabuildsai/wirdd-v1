import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

export default function OnboardingScreen() {
  const router = useRouter();

  async function handleComplete() {
    await AsyncStorage.setItem('@wirdd/onboarded', '1');
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>وِرد</Text>
      <Text style={styles.subtitle}>Wirdd</Text>
      <Text style={styles.body}>Say it. Wirdd counts it.</Text>
      <TouchableOpacity style={styles.button} onPress={handleComplete}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
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
  title: {
    fontFamily: Fonts.arabic,
    fontSize: 64,
    color: Colors.gold,
  },
  subtitle: {
    fontFamily: Fonts.displayLight,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: 8,
  },
  body: {
    fontFamily: Fonts.ui,
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  button: {
    marginTop: 48,
    backgroundColor: Colors.gold,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    fontFamily: Fonts.uiMedium,
    fontSize: 16,
    color: Colors.background,
  },
});
