import { Text as RNText, type TextProps, type StyleProp, type TextStyle } from 'react-native';

interface Props extends TextProps {
  size?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Renders emoji with the system font. Our <Text> applies a custom font family
 * (Outfit/JetBrains Mono), and on Android a set fontFamily suppresses the emoji
 * fallback — so emoji render as missing-glyph boxes. Use this for any standalone
 * emoji "icon" so the platform emoji font is used instead.
 */
export default function Emoji({ size, style, ...rest }: Props) {
  return <RNText {...rest} style={[size != null ? { fontSize: size } : null, style]} />;
}
