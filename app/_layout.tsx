import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { initDatabase, recoverInterruptedSessions } from '@/services/database';
import {
  registerForegroundServiceHandler,
  stopForegroundService,
} from '@/services/foregroundService';

// ── Notifee setup (module-level — must run before first render) ───────────────
if (Platform.OS === 'android') {
  try {
    registerForegroundServiceHandler();
  } catch (e) {
    console.warn('[notifee] startup registration failed:', e);
  }
}

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.ttf'),
    'CormorantGaramond-Light': require('../assets/fonts/CormorantGaramond-Light.ttf'),
    'CormorantGaramond-Regular': require('../assets/fonts/CormorantGaramond-Regular.ttf'),
    'DMSans-Regular': require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
  });

  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        initDatabase();
        recoverInterruptedSessions();
        const value = await AsyncStorage.getItem('@wirdd/onboarded');
        if (!cancelled) {
          setHasOnboarded(value === '1');
          setStorageReady(true);
          setStartupError(null);
        }
      } catch {
        if (!cancelled) setStartupError('Wirdd could not open your saved history. Check available storage and retry.');
      }
    }
    void stopForegroundService().catch(() => {});
    void initialize();
    return () => { cancelled = true; };
  }, [attempt]);


  const ready = (fontsLoaded || fontError != null) && hasOnboarded !== null && storageReady;

  useEffect(() => {
    if (ready || startupError) void SplashScreen.hideAsync();
  }, [ready, startupError]);

  // One-shot redirect on first load — fires only when ready transitions true.
  // Using useEffect (not declarative <Redirect>) so it doesn't re-fire while
  // the user navigates through the onboarding → permission flow.
  useEffect(() => {
    if (!ready) return;
    if (!hasOnboarded) {
      router.replace('/onboarding');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (startupError) return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 32, gap: 24 }}>
      <Text accessibilityRole="alert" style={{ color: Colors.textPrimary, fontSize: 18 }}>{startupError}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setStartupError(null); setAttempt(value => value + 1); }} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: Colors.gold, fontSize: 18 }}>Retry</Text>
      </Pressable>
    </View>
  );
  if (!ready) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="permission/index" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar style="light" backgroundColor={Colors.background} />
    </>
  );
}
