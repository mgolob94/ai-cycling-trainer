import { useRef, type ReactNode } from 'react';
import { View, Pressable, Animated, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

import { radius, shadows } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

type CardVariant = 'default' | 'raised' | 'dark' | 'tinted';

interface Props {
  variant?: CardVariant;
  /** Inner padding (defaults to 16). */
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Surface container.
 *  - default: surface bg, 1px border, radius 16
 *  - raised:  surface bg, md shadow, radius 16
 *  - dark:    slate-900 hero (light theme) / elevated dark surface (dark theme)
 *  - tinted:  surfaceRaised bg, radius 12, no border
 */
export default function Card({ variant = 'default', padding = 16, onPress, style, children }: Props) {
  const { colors, isDark } = useThemeColors();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'raised':
        return { backgroundColor: colors.surface, borderRadius: radius.lg, ...shadows.md };
      case 'dark':
        // "Hero" surface: solid emerald in light, neutral dark in dark mode.
        return {
          backgroundColor: colors.surfaceHero,
          borderRadius: radius.lg,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.border,
        };
      case 'tinted':
        return { backgroundColor: colors.surfaceRaised, borderRadius: radius.md };
      case 'default':
      default:
        return {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        };
    }
  })();

  const content = [styles.base, variantStyle, { padding }, style];
  const scale = useRef(new Animated.Value(1)).current;

  if (onPress) {
    const pressIn = () =>
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    const pressOut = () =>
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    return (
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View style={[content, { transform: [{ scale }] }]}>{children}</Animated.View>
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
