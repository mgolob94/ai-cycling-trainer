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
}

const VALUE_VARIANT: Record<StatSize, 'statSm' | 'statMd' | 'stat'> = {
  sm: 'statSm',
  md: 'statMd',
  lg: 'stat',
};

/** Number-forward stat block (JetBrains Mono value). Used for FTP/CTL/ATL/TSB/etc. */
export default function StatCard({ value, unit, label, trend = null, size = 'md' }: Props) {
  const positive = typeof trend === 'string' && trend.trim().startsWith('+');
  const trendColor = positive ? palette.emerald600 : palette.rose600;
  const arrow = positive ? '↑' : '↓';

  return (
    <View style={styles.wrap}>
      <View style={styles.valueRow}>
        <Text variant={VALUE_VARIANT[size]}>{String(value)}</Text>
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
