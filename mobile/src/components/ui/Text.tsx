import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { typography, type TypographyVariant } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

interface Props extends TextProps {
  /** Typography preset to apply. Defaults to "body". */
  variant?: TypographyVariant;
  /** Override the preset's text color. */
  color?: string;
}

const styles = StyleSheet.create(typography);

// Variants that read as secondary text get the muted color by default.
const SECONDARY_VARIANTS = new Set<TypographyVariant>(['caption', 'label']);

/**
 * App-wide text component. Always use this instead of React Native's raw
 * <Text>. Pulls from the typography scale and resolves its default color from
 * the active theme (so it stays readable in light and dark) unless `color` is
 * given.
 */
export default function Text({ variant = 'body', color, style, ...rest }: Props) {
  const { colors } = useTheme();
  const themeColor = SECONDARY_VARIANTS.has(variant) ? colors.textSecondary : colors.textPrimary;
  return (
    <RNText style={[styles[variant], { color: color ?? themeColor }, style]} {...rest} />
  );
}
