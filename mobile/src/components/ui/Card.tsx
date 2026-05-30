import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

import { palette, radius, shadows } from '../../theme/tokens';
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
        return {
          backgroundColor: isDark ? colors.surface : palette.slate900,
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

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [content, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  pressed: { opacity: 0.9 },
});
