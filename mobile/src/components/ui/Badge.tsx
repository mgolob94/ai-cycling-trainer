import { View, StyleSheet } from 'react-native';

import Text from './Text';
import { palette, radius, spacing } from '../../theme/tokens';

type BadgeColor = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

interface Props {
  label: string;
  color?: BadgeColor;
}

// Each color: a light background + a dark text tone from the same ramp.
const COLOR_MAP: Record<BadgeColor, { bg: string; fg: string }> = {
  default: { bg: palette.slate100, fg: palette.slate600 },
  indigo: { bg: palette.indigo50, fg: palette.indigo600 },
  emerald: { bg: palette.emerald50, fg: palette.emerald600 },
  amber: { bg: palette.amber50, fg: palette.amber600 },
  rose: { bg: palette.rose50, fg: palette.rose600 },
  sky: { bg: palette.sky50, fg: palette.sky600 },
};

/** Small status pill — uppercase, 11px, semibold, letter-spaced. */
export default function Badge({ label, color = 'default' }: Props) {
  const { bg, fg } = COLOR_MAP[color];
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
