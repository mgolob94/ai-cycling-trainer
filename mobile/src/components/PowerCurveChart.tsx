import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';

import { lightColors, fontSize } from '../theme';

export interface PdcPoint {
  duration_sec: number;
  power_watts: number;
}

interface Props {
  points: PdcPoint[];
  reference?: PdcPoint[]; // optional overlay (e.g. all-time)
  width: number;
  height?: number;
  typeLabel?: string;
}

const PAD_LEFT = 36;
const PAD_RIGHT = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

// Log-scale tick anchors with short labels.
const X_TICKS = [
  { sec: 5, label: '5s' },
  { sec: 60, label: '1m' },
  { sec: 300, label: '5m' },
  { sec: 1200, label: '20m' },
  { sec: 3600, label: '1h' },
];

/** Power-duration curve on a log X axis, with an optional reference overlay. */
export default function PowerCurveChart({ points, reference, width, height = 220, typeLabel }: Props) {
  const all = [...points, ...(reference ?? [])];
  if (!points.length) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No power-duration data yet.</Text>
      </View>
    );
  }

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const minD = 5;
  const maxD = 5400;
  const logMin = Math.log10(minD);
  const logMax = Math.log10(maxD);
  const maxP = Math.max(...all.map((p) => p.power_watts), 1);

  const xFor = (sec: number) =>
    PAD_LEFT + ((Math.log10(Math.min(Math.max(sec, minD), maxD)) - logMin) / (logMax - logMin)) * plotW;
  const yFor = (w: number) => PAD_TOP + plotH - (w / maxP) * plotH;

  const toLine = (pts: PdcPoint[]) =>
    [...pts]
      .sort((a, b) => a.duration_sec - b.duration_sec)
      .map((p) => `${xFor(p.duration_sec)},${yFor(p.power_watts)}`)
      .join(' ');

  // Best point = highest power (typically the shortest duration).
  const best = points.reduce((m, p) => (p.power_watts > m.power_watts ? p : m), points[0]);

  const yTicks = 3;
  const grid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const w = (maxP * i) / yTicks;
    return { w, y: yFor(w) };
  });

  return (
    <Svg width={width} height={height}>
      {grid.map((g, i) => (
        <Line key={`g-${i}`} x1={PAD_LEFT} y1={g.y} x2={width - PAD_RIGHT} y2={g.y} stroke={lightColors.border} strokeWidth={1} />
      ))}
      {grid.map((g, i) => (
        <SvgText key={`yl-${i}`} x={PAD_LEFT - 5} y={g.y + 3} fontSize={9} fill={lightColors.textMuted} textAnchor="end">
          {Math.round(g.w)}
        </SvgText>
      ))}
      {X_TICKS.map((t) => (
        <SvgText key={`xl-${t.sec}`} x={xFor(t.sec)} y={height - 8} fontSize={9} fill={lightColors.textMuted} textAnchor="middle">
          {t.label}
        </SvgText>
      ))}

      {reference && reference.length ? (
        <Polyline points={toLine(reference)} fill="none" stroke={lightColors.textMuted} strokeWidth={1} strokeDasharray="4 3" />
      ) : null}

      <Polyline points={toLine(points)} fill="none" stroke={lightColors.primary} strokeWidth={2.5} />
      <Circle cx={xFor(best.duration_sec)} cy={yFor(best.power_watts)} r={4} fill={lightColors.primary} />

      {typeLabel ? (
        <SvgText x={width - PAD_RIGHT} y={PAD_TOP + 4} fontSize={11} fontWeight="bold" fill={lightColors.text} textAnchor="end">
          {typeLabel}
        </SvgText>
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: lightColors.textMuted, fontSize: fontSize.md },
});
