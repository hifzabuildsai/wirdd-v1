import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Colors } from '@/constants/colors';
import { initDatabase } from '@/services/database';

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

  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@wirdd/onboarded').then((value) => {
      setHasOnboarded(value === '1');
    });
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
