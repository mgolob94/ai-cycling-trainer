import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fontSize } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** 0–100. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Big number rendered in the middle (defaults to the rounded percent). */
  label?: string;
  /** Smaller caption under the label. */
  caption?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Animated circular progress ring. Uses the built-in Animated API (not
 * reanimated, which is intentionally not installed — it crashed on startup in
 * Expo Go) to tween strokeDashoffset on an SVG circle.
 */
export default function CircularProgress({
  percent,
  size = 200,
  strokeWidth = 14,
  color = colors.primary,
  trackColor = colors.surfaceAlt,
  label,
  caption,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamped,
      duration: 600,
      useNativeDriver: false, // SVG props can't run on the native driver
    }).start();
  }, [clamped, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          // Start the arc at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.label}>{label ?? `${Math.round(clamped)}%`}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '800' },
  caption: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4 },
});
