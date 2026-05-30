import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import { lightColors, fontSize } from '../theme';

export interface ChartSeries {
  color: string;
  values: number[];
}

interface Props {
  series: ChartSeries[];
  labels: string[];
  width: number;
  height?: number;
}

const PAD_LEFT = 38;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

/** Lightweight multi-line chart (no extra charting deps) drawn with SVG. */
export default function MultiLineChart({ series, labels, width, height = 200 }: Props) {
  const allValues = series.flatMap((s) => s.values);
  if (!allValues.length) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  let min = Math.min(...allValues, 0);
  let max = Math.max(...allValues, 0);
  if (min === max) max = min + 1;
  const range = max - min;

  const n = labels.length;
  const xFor = (i: number) => PAD_LEFT + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (v: number) => PAD_TOP + plotH - ((v - min) / range) * plotH;

  // Horizontal gridlines / Y labels.
  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = min + (range * i) / ticks;
    return { v, y: yFor(v) };
  });

  // Show ~4 x labels to avoid crowding.
  const labelStep = Math.max(1, Math.ceil(n / 4));

  return (
    <Svg width={width} height={height}>
      {gridLines.map((g, i) => (
        <Line
          key={`grid-${i}`}
          x1={PAD_LEFT}
          y1={g.y}
          x2={width - PAD_RIGHT}
          y2={g.y}
          stroke={lightColors.border}
          strokeWidth={1}
        />
      ))}
      {gridLines.map((g, i) => (
        <SvgText
          key={`ylab-${i}`}
          x={PAD_LEFT - 6}
          y={g.y + 3}
          fontSize={10}
          fill={lightColors.textMuted}
          textAnchor="end"
        >
          {Math.round(g.v)}
        </SvgText>
      ))}

      {/* Zero line emphasized when the range crosses zero (useful for TSB). */}
      {min < 0 && max > 0 ? (
        <Line
          x1={PAD_LEFT}
          y1={yFor(0)}
          x2={width - PAD_RIGHT}
          y2={yFor(0)}
          stroke={lightColors.textMuted}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}

      {labels.map((label, i) =>
        i % labelStep === 0 || i === n - 1 ? (
          <SvgText
            key={`xlab-${i}`}
            x={xFor(i)}
            y={height - 8}
            fontSize={10}
            fill={lightColors.textMuted}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ) : null
      )}

      {series.map((s, si) => (
        <Polyline
          key={`line-${si}`}
          points={s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: lightColors.textMuted, fontSize: fontSize.md },
});
