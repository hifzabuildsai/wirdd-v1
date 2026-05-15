import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';

interface Props {
  detectionSignal: SharedValue<number>;
  size?: number;
}

export function ShockwaveRing({ detectionSignal, size = 220 }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useAnimatedReaction(
    () => detectionSignal.value,
    (current, previous) => {
      'worklet';
      if (previous !== null && current !== previous) {
        // reset then animate outward
        opacity.value = 0.7;
        scale.value = 1;
        opacity.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) });
        scale.value = withTiming(2.2, { duration: 900, easing: Easing.out(Easing.quad) });
      }
    },
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.gold,
  },
});
