import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { Colors } from '@/constants/colors';

const DOT_SIZE = 5;
const STAGGER_MS = 180;

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 540, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    // opacity is a stable shared value ref; delay is a static number — both safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, animStyle]} />;
}

export function ListeningIndicator() {
  return (
    <View style={styles.row}>
      <Dot delay={0} />
      <Dot delay={STAGGER_MS} />
      <Dot delay={STAGGER_MS * 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.gold,
  },
});
