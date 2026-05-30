import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import Text from './Text';
import MetricTooltip, { type MetricKey } from '../metrics/MetricTooltip';
import TrainingScaleBar, { type ScaleZone } from '../metrics/TrainingScaleBar';
import { palette, spacing } from '../../theme/tokens';

type StatSize = 'sm' | 'md' | 'lg';
export type StatDisplayMode = 'number' | 'contextual' | 'both';

interface Props {
  value: string | number;
  unit?: string;
  label?: string;
  /** e.g. "+12%" / "-3%" — colored green/red with a direction arrow. Null = hidden. */
  trend?: string | null;
  size?: StatSize;
  /** Count up from 0 → value on mount (numeric values only). Default true. */
  animate?: boolean;
  /** Plain-language interpretation (from metricsInterpreter). Enables contextual modes. */
  interpretation?: string;
  /** Metric key → shows a ⓘ tooltip trigger next to the value/label. */
  tooltipMetric?: MetricKey;
  /** Value passed to the tooltip for personalization (defaults to numeric value). */
  tooltipValue?: number;
  /** Mini scale bar config rendered under the stat. */
  scaleConfig?: { min: number; max: number; zones: ScaleZone[] };
  /** How to present value vs interpretation. Default 'both' (when interpretation given). */
  displayMode?: StatDisplayMode;
}

const VALUE_VARIANT: Record<StatSize, 'statSm' | 'statMd' | 'stat'> = {
  sm: 'statSm',
  md: 'statMd',
  lg: 'stat',
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

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

/**
 * Number-forward stat block (JetBrains Mono value). Supports a contextual mode:
 * pass `interpretation` to lead with plain language and demote the raw number,
 * `tooltipMetric` for a ⓘ explainer, and `scaleConfig` for a mini scale bar.
 */
export default function StatCard({
  value,
  unit,
  label,
  trend = null,
  size = 'md',
  animate = true,
  interpretation,
  tooltipMetric,
  tooltipValue,
  scaleConfig,
  displayMode = 'both',
}: Props) {
  const positive = typeof trend === 'string' && trend.trim().startsWith('+');
  const trendColor = positive ? palette.emerald600 : palette.rose600;
  const arrow = positive ? '↑' : '↓';

  const numeric = typeof value === 'number' && Number.isInteger(value);
  const counted = useCountUp(numeric ? (value as number) : 0, numeric && animate);
  const display = numeric ? String(counted) : String(value);
  const ttValue = tooltipValue ?? (typeof value === 'number' ? value : undefined);

  const trendEl = trend ? (
    <Text variant="caption" color={trendColor} style={styles.trend}>
      {arrow} {trend.replace(/^[+-]/, '')}
    </Text>
  ) : null;

  const tooltipEl = tooltipMetric ? <MetricTooltip metric={tooltipMetric} value={ttValue} /> : null;
  const scaleEl = scaleConfig ? (
    <View style={styles.scale}>
      <TrainingScaleBar value={typeof value === 'number' ? value : 0} {...scaleConfig} />
    </View>
  ) : null;

  // Contextual / both: lead with the interpretation.
  if (interpretation && displayMode !== 'number') {
    return (
      <View style={styles.wrap}>
        <Text variant="body" style={styles.interpretation}>
          {interpretation}
        </Text>
        {displayMode === 'both' ? (
          <View style={styles.secondaryRow}>
            {label ? (
              <Text variant="caption" color={palette.slate400}>
                {label}
              </Text>
            ) : null}
            <Text variant="statSm" color={palette.slate400}>
              {display}
              {unit ? <Text variant="caption" color={palette.slate400}>{` ${unit}`}</Text> : null}
            </Text>
            {tooltipEl}
            <View style={styles.flex} />
            {trendEl}
          </View>
        ) : null}
        {scaleEl}
      </View>
    );
  }

  // Number mode (default for existing call sites without interpretation).
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
        {tooltipEl}
        <View style={styles.flex} />
        {trendEl}
      </View>
      {scaleEl}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] },
  unit: { marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  trend: { fontWeight: '600' },
  interpretation: { fontWeight: '600' },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  scale: { marginTop: spacing[2] },
});
