import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

interface Props {
  count: number;
  detectionSignal: SharedValue<number>;
}

export function CounterCircle({ count, detectionSignal }: Props) {
  const scale = useSharedValue(1);

  useAnimatedReaction(
    () => detectionSignal.value,
    (current, previous) => {
      'worklet';
      if (previous !== null && current !== previous) {
        scale.value = withSpring(1.15, { damping: 4, stiffness: 300 }, () => {
          'worklet';
          scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        });
      }
    },
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.circle, animStyle]}>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>اَسْتَغْفِرُ اللّٰه</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  count: {
    fontFamily: Fonts.displayLight,
    fontSize: 72,
    color: Colors.gold,
    lineHeight: 80,
    includeFontPadding: false,
  },
  label: {
    fontFamily: Fonts.arabic,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
