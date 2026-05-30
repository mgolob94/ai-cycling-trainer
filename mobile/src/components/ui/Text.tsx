import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { typography, type TypographyVariant } from '../../theme/typography';

interface Props extends TextProps {
  /** Typography preset to apply. Defaults to "body". */
  variant?: TypographyVariant;
  /** Override the preset's text color. */
  color?: string;
}

const styles = StyleSheet.create(typography);

/**
 * App-wide text component. Always use this instead of React Native's raw
 * <Text> so every label pulls from the typography scale (and the right custom
 * font). Pass `variant` to pick a preset and `color` to override its color.
 */
export default function Text({ variant = 'body', color, style, ...rest }: Props) {
  return <RNText style={[styles[variant], color ? { color } : null, style]} {...rest} />;
}
