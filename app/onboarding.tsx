import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

const { width: W } = Dimensions.get('window');

// ── Glow helper ────────────────────────────────────────────────────────────

function GoldGlow() {
  return (
    <View style={glow.wrap} pointerEvents="none">
      <View style={[glow.circle, { width: 320, height: 320, borderRadius: 160 }]} />
      <View style={[glow.circle, { width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(200,168,75,0.07)' }]} />
      <View style={[glow.circle, { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(200,168,75,0.12)' }]} />
    </View>
  );
}

const glow = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(200,168,75,0.04)',
  },
});

// ── Slides ─────────────────────────────────────────────────────────────────

function SplashSlide() {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.72);

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(300, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    // stable shared value refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[slide.container, { width: W }]}>
      <GoldGlow />
      <Animated.View style={[slide.logoWrap, animStyle]}>
        <Text style={slide.arabicLogo}>وِرد</Text>
        <Text style={slide.latinLogo}>W I R D D</Text>
      </Animated.View>
    </View>
  );
}

function ProblemSlide() {
  return (
    <View style={[slide.container, { width: W }]}>
      <Text style={slide.arabicPhrase}>أَسْتَغْفِرُ اللّٰه</Text>
      <Text style={slide.headline}>How many times{'\n'}today?</Text>
      <Text style={slide.sub}>You say it constantly. You never know how many.</Text>
    </View>
  );
}

function SolutionSlide() {
  return (
    <View style={[slide.container, { width: W }]}>
      <Text style={slide.headlineGold}>No tapping.</Text>
      <Text style={slide.headline}>Wird listens.</Text>
      <Text style={slide.sub}>
        Like a step counter — but for dhikr. Say it, Wird counts it.
      </Text>
    </View>
  );
}

function PrivacySlide({ onBegin }: { onBegin: () => void }) {
  return (
    <View style={[slide.container, { width: W }]}>
      <Text style={slide.headline}>Between you{'\n'}and Allah.</Text>
      <Text style={slide.sub}>
        Wirdd requests Android&apos;s on-device speech recognizer.{'\n'}
        Voice counting needs Android 13+ and an installed Arabic on-device model.
      </Text>
      <Pressable style={slide.cta} onPress={onBegin}>
        <Text style={slide.ctaText}>Begin →</Text>
      </Pressable>
    </View>
  );
}

const slide = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  logoWrap: {
    alignItems: 'center',
    gap: 12,
  },
  arabicLogo: {
    fontFamily: Fonts.arabic,
    fontSize: 88,
    color: Colors.gold,
    includeFontPadding: false,
  },
  latinLogo: {
    fontFamily: Fonts.displayLight,
    fontSize: 14,
    color: Colors.textMuted,
    letterSpacing: 8,
  },
  arabicPhrase: {
    fontFamily: Fonts.arabic,
    fontSize: 38,
    color: Colors.gold,
    marginBottom: 8,
  },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
  },
  headlineGold: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.gold,
    textAlign: 'center',
  },
  sub: {
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  cta: {
    marginTop: 32,
    backgroundColor: Colors.gold,
    paddingHorizontal: 48,
    paddingVertical: 15,
    borderRadius: 32,
  },
  ctaText: {
    fontFamily: Fonts.uiMedium,
    fontSize: 17,
    color: Colors.background,
    letterSpacing: 0.5,
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────

const SLIDES = ['splash', 'problem', 'solution', 'privacy'] as const;
type SlideKey = (typeof SLIDES)[number];

export default function OnboardingScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<SlideKey>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleSkip() {
    AsyncStorage.setItem('@wirdd/onboarded', '1');
    router.replace('/(tabs)');
  }

  function handleBegin() {
    router.push('/permission');
  }

  function renderSlide({ item }: ListRenderItemInfo<SlideKey>) {
    switch (item) {
      case 'splash':   return <SplashSlide />;
      case 'problem':  return <ProblemSlide />;
      case 'solution': return <SolutionSlide />;
      case 'privacy':  return <PrivacySlide onBegin={handleBegin} />;
    }
  }

  return (
    <View style={styles.container}>
      {/* Skip */}
      <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={16}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {/* Slides */}
      <FlatList<SlideKey>
        ref={listRef}
        data={[...SLIDES]}
        keyExtractor={(item) => item}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / W);
          setActiveIndex(idx);
        }}
      />

      {/* Progress dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dots: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  dotActive: {
    backgroundColor: Colors.gold,
    width: 20,
    borderRadius: 3,
  },
});
