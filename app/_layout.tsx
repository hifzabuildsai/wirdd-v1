import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import notifee from '@notifee/react-native';

import { Colors } from '@/constants/colors';
import { initDatabase } from '@/services/database';
import {
  registerForegroundServiceHandler,
  handleBackgroundEvent,
} from '@/services/foregroundService';
import {
  signInAnonymously,
  getCurrentUserId,
  fetchIsPro,
  ensureProfile,
} from '@/services/supabase';
import { useProfileStore } from '@/stores/profileStore';

// ── Notifee setup (module-level — must run before first render) ───────────────
if (Platform.OS === 'android') {
  registerForegroundServiceHandler();
  notifee.onBackgroundEvent(handleBackgroundEvent);
}

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.ttf'),
    'CormorantGaramond-Light': require('../assets/fonts/CormorantGaramond-Light.ttf'),
    'CormorantGaramond-Regular': require('../assets/fonts/CormorantGaramond-Regular.ttf'),
    'DMSans-Regular': require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
  });

  const { loadFromCache, setIsPro } = useProfileStore();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@wirdd/onboarded').then((value) => {
      setHasOnboarded(value === '1');
    });
  }, []);

  // Load cached isPro immediately, then verify against Supabase in background
  useEffect(() => {
    loadFromCache();
    (async () => {
      let userId = await getCurrentUserId();
      if (!userId) userId = await signInAnonymously();
      if (!userId) return;
      await ensureProfile(userId);
      const pro = await fetchIsPro(userId);
      setIsPro(pro);
    })().catch(() => {});
  }, []);

  // Re-verify isPro when payment deep link fires (wirdd://payment-success)
  useEffect(() => {
    async function handleDeepLink(url: string) {
      if (!url.startsWith('wirdd://payment-success')) return;
      const userId = await getCurrentUserId();
      if (!userId) return;
      const pro = await fetchIsPro(userId);
      if (pro) setIsPro(true);
    }

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  const ready = (fontsLoaded || fontError != null) && hasOnboarded !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

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
      </Stack>
      <StatusBar style="light" backgroundColor={Colors.background} />
      {!hasOnboarded && <Redirect href="/onboarding" />}
    </>
  );
}
