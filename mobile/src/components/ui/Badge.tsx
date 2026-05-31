import { View, StyleSheet } from 'react-native';

import Text from './Text';
import { palette, radius, spacing } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

type BadgeColor = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

interface Props {
  label: string;
  color?: BadgeColor;
}

// Light: soft pastel bg + dark text from the same ramp.
const LIGHT_MAP: Record<BadgeColor, { bg: string; fg: string }> = {
  default: { bg: palette.slate100, fg: palette.slate600 },
  indigo: { bg: palette.indigo50, fg: palette.indigo600 },
  emerald: { bg: palette.emerald50, fg: palette.emerald600 },
  amber: { bg: palette.amber50, fg: palette.amber600 },
  rose: { bg: palette.rose50, fg: palette.rose600 },
  sky: { bg: palette.sky50, fg: palette.sky600 },
};

// Dark: translucent tint of the accent + bright (400) text for strong contrast.
const DARK_MAP: Record<BadgeColor, { bg: string; fg: string }> = {
  default: { bg: 'rgba(212,212,210,0.14)', fg: palette.slate200 },
  indigo: { bg: 'rgba(99,102,241,0.22)', fg: palette.indigo400 },
  emerald: { bg: 'rgba(52,211,153,0.20)', fg: palette.emerald400 },
  amber: { bg: 'rgba(251,191,36,0.20)', fg: palette.amber400 },
  rose: { bg: 'rgba(251,113,133,0.20)', fg: palette.rose400 },
  sky: { bg: 'rgba(56,189,248,0.20)', fg: palette.sky400 },
};

/** Small status pill — uppercase, 11px, semibold, letter-spaced. */
export default function Badge({ label, color = 'default' }: Props) {
  const { isDark } = useThemeColors();
  const { bg, fg } = (isDark ? DARK_MAP : LIGHT_MAP)[color];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="label" color={fg} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  text: { fontSize: 11, letterSpacing: 0.5 },
});
