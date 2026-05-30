import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import Text from './Text';
import { palette, spacing } from '../../theme/tokens';

type StatSize = 'sm' | 'md' | 'lg';

interface Props {
  value: string | number;
  unit?: string;
  label?: string;
  /** e.g. "+12%" / "-3%" — colored green/red with a direction arrow. Null = hidden. */
  trend?: string | null;
  size?: StatSize;
  /** Count up from 0 → value on mount (numeric values only). Default true. */
  animate?: boolean;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Counts an integer up from 0 → `value` over `duration` ms (easeOutCubic). */
function useCountUp(value: number, enabled: boolean, duration = 800): number {
  const [display, setDisplay] = useState(enabled ? 0 : value);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDisplay(value);
      return undefined;
    }
    const start = Date.now();
    raf.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setDisplay(Math.round(value * easeOutCubic(t)));
      if (t >= 1 && raf.current) clearInterval(raf.current);
    }, 30);
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, [value, enabled, duration]);

  return display;
}

const VALUE_VARIANT: Record<StatSize, 'statSm' | 'statMd' | 'stat'> = {
  sm: 'statSm',
  md: 'statMd',
  lg: 'stat',
};

/** Number-forward stat block (JetBrains Mono value). Used for FTP/CTL/ATL/TSB/etc. */
export default function StatCard({ value, unit, label, trend = null, size = 'md', animate = true }: Props) {
  const positive = typeof trend === 'string' && trend.trim().startsWith('+');
  const trendColor = positive ? palette.emerald600 : palette.rose600;
  const arrow = positive ? '↑' : '↓';

  // Count up only for integer values; strings (durations, "—", decimals) render as-is.
  const numeric = typeof value === 'number' && Number.isInteger(value);
  const counted = useCountUp(numeric ? (value as number) : 0, numeric && animate);
  const display = numeric ? String(counted) : String(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.valueRow}>
        <Text variant={VALUE_VARIANT[size]}>{display}</Text>
        {unit ? (
          <Text variant="caption" color={palette.slate400} style={styles.unit}>
            {unit}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaRow}>
        {label ? <Text variant="label">{label}</Text> : null}
        {trend ? (
          <Text variant="caption" color={trendColor} style={styles.trend}>
            {arrow} {trend.replace(/^[+-]/, '')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] },
  unit: { marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  trend: { fontWeight: '600' },
});
