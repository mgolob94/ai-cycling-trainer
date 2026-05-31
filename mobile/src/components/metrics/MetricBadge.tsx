import { View, StyleSheet } from 'react-native';

import Text from '../ui/Text';
import { getRange, getWkgRange, type MetricContextKey, type MetricRange } from '../../services/metricContext';
import { zoneColors, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  metric: MetricContextKey;
  /** The metric's value (used for the range lookup; e.g. TSS 88, TSB +12). */
  value: number;
  /** For FTP, the W/kg ratio — drives the category label (e.g. "Serious amateur"). */
  wkg?: number;
  /** Show the range label chip (default true). */
  showLabel?: boolean;
  /** Show a small range-position bar below the chip (default false). */
  showBar?: boolean;
}

/**
 * A small contextual label shown next to a raw metric value so a number never
 * stands alone — e.g. "Hard" next to TSS 88, "Solid fitness" next to CTL 74.
 * Pulls its label/color from METRIC_CONTEXT.
 */
export default function MetricBadge({ metric, value, wkg, showLabel = true, showBar = false }: Props) {
  const { colors } = useTheme();

  const range: MetricRange | null = metric === 'ftp' ? (wkg != null ? getWkgRange(wkg) : null) : getRange(metric, value);
  if (!range) return null;

  const color = resolveColor(range.color, colors);

  // Mini bar: how far `value` sits inside its matched range (open ends clamped).
  const lo = range.min ?? 0;
  const hi = range.max != null && range.max < 900 ? range.max : Math.max(value * 1.4, lo + 1);
  const fill = Math.max(0.06, Math.min(1, (value - lo) / (hi - lo || 1)));

  return (
    <View style={styles.wrap}>
      {showLabel ? (
        <View style={[styles.chip, { backgroundColor: `${color}22` }]}>
          <Text variant="label" color={color} style={styles.label}>
            {range.label}
          </Text>
        </View>
      ) : null}
      {showBar ? (
        <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
          <View style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: color }]} />
        </View>
      ) : null}
    </View>
  );
}

/** Range `color` token → concrete color (zone key or status key). */
function resolveColor(token: string | undefined, colors: ReturnType<typeof useTheme>['colors']): string {
  if (!token) return colors.textSecondary;
  if (token in zoneColors) return zoneColors[token as keyof typeof zoneColors];
  if (token === 'green') return colors.green ?? colors.primary;
  if (token === 'warning') return colors.warning;
  if (token === 'danger') return colors.danger;
  return colors.textSecondary;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: 4 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, alignSelf: 'flex-start' },
  label: { fontSize: 11, letterSpacing: 0.5 },
  barTrack: { width: 40, height: 3, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },
});
