import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type DimensionValue } from 'react-native';

import { radius as radii } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

interface Props {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
}

/**
 * Shimmer placeholder for loading states. The design doc calls for reanimated,
 * but it's intentionally not installed (it crashed on startup in Expo Go), so
 * this uses the built-in Animated API — a smooth opacity pulse that reads as a
 * shimmer and runs on the native driver.
 */
export default function SkeletonLoader({ width = '100%', height = 16, borderRadius = radii.sm }: Props) {
  const { colors } = useThemeColors();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          opacity: pulse,
          backgroundColor: colors.surfaceRaised,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
