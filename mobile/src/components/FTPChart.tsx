import { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, Rect } from 'react-native-svg';

import type { FtpTest } from '../hooks/useFtp';
import { lightColors, spacing, radius, fontSize } from '../theme';

interface Props {
  history: FtpTest[];
  width?: number;
  height?: number;
}

const PAD_LEFT = 40;
const PAD_RIGHT = 46;
const PAD_TOP = 30;
const PAD_BOTTOM = 26;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Ordinary-least-squares slope/intercept for points (i, y). */
function linearRegression(values: number[]) {
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  values.forEach((y, i) => {
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  });
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** FTP progression line chart: dual axis (watts / W·kg⁻¹), trend line, tap to annotate. */
export default function FTPChart({ history, width, height = 220 }: Props) {
  const chartWidth = width ?? Dimensions.get('window').width - spacing.lg * 4;
  const points = history.filter((h) => h.ftp_watts != null);
  const [selected, setSelected] = useState<number>(points.length - 1);

  if (!points.length) {
    return (
      <View style={[styles.empty, { width: chartWidth, height }]}>
        <Text style={styles.emptyText}>Run an FTP test to start tracking progress.</Text>
      </View>
    );
  }

  const watts = points.map((p) => p.ftp_watts);
  const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  let min = Math.min(...watts);
  let max = Math.max(...watts);
  // Pad the range so the line isn't flush against the edges.
  const pad = Math.max(5, (max - min) * 0.15);
  min = Math.floor(min - pad);
  max = Math.ceil(max + pad);
  const range = max - min || 1;

  const n = points.length;
  const xFor = (i: number) => PAD_LEFT + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (w: number) => PAD_TOP + plotH - ((w - min) / range) * plotH;

  // Right axis: convert watt ticks to W/kg using the latest known weight.
  const weight = points[points.length - 1].weight_kg ?? null;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const w = min + (range * i) / ticks;
    return { w, y: yFor(w) };
  });

  // Trend line via linear regression on the watt values.
  const { slope, intercept } = linearRegression(watts);
  const trendStart = { x: xFor(0), y: yFor(intercept) };
  const trendEnd = { x: xFor(n - 1), y: yFor(slope * (n - 1) + intercept) };

  const labelStep = Math.max(1, Math.ceil(n / 4));

  // Motivational label: >5% improvement vs the previous test.
  let improvement: number | null = null;
  if (n >= 2) {
    const prev = watts[n - 2];
    const last = watts[n - 1];
    if (prev > 0) improvement = ((last - prev) / prev) * 100;
  }
  const showBoost = improvement != null && improvement > 5;

  const sel = points[selected] ?? points[points.length - 1];
  const selX = xFor(selected);
  const selY = yFor(sel.ftp_watts);
  // Keep the tooltip within bounds.
  const tipW = 96;
  const tipX = Math.min(Math.max(selX - tipW / 2, PAD_LEFT), chartWidth - PAD_RIGHT - tipW);

  return (
    <View>
      {showBoost ? (
        <View style={styles.boost}>
          <Text style={styles.boostText}>
            🔥 FTP up {improvement!.toFixed(1)}% since your last test — keep it up!
          </Text>
        </View>
      ) : null}

      <Svg width={chartWidth} height={height}>
        {/* gridlines + left (watts) and right (W/kg) axis labels */}
        {gridLines.map((g, i) => (
          <Line
            key={`g-${i}`}
            x1={PAD_LEFT}
            y1={g.y}
            x2={chartWidth - PAD_RIGHT}
            y2={g.y}
            stroke={lightColors.border}
            strokeWidth={1}
          />
        ))}
        {gridLines.map((g, i) => (
          <SvgText
            key={`yl-${i}`}
            x={PAD_LEFT - 6}
            y={g.y + 3}
            fontSize={10}
            fill={lightColors.textMuted}
            textAnchor="end"
          >
            {Math.round(g.w)}
          </SvgText>
        ))}
        {weight
          ? gridLines.map((g, i) => (
              <SvgText
                key={`yr-${i}`}
                x={chartWidth - PAD_RIGHT + 6}
                y={g.y + 3}
                fontSize={10}
                fill={lightColors.textMuted}
                textAnchor="start"
              >
                {(g.w / weight).toFixed(1)}
              </SvgText>
            ))
          : null}

        {/* axis captions */}
        <SvgText x={PAD_LEFT - 6} y={PAD_TOP - 12} fontSize={9} fill={lightColors.textMuted} textAnchor="end">
          W
        </SvgText>
        {weight ? (
          <SvgText
            x={chartWidth - PAD_RIGHT + 6}
            y={PAD_TOP - 12}
            fontSize={9}
            fill={lightColors.textMuted}
            textAnchor="start"
          >
            W/kg
          </SvgText>
        ) : null}

        {/* trend line */}
        <Line
          x1={trendStart.x}
          y1={trendStart.y}
          x2={trendEnd.x}
          y2={trendEnd.y}
          stroke={lightColors.textMuted}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* FTP line (app blue) */}
        <Polyline
          points={points.map((p, i) => `${xFor(i)},${yFor(p.ftp_watts)}`).join(' ')}
          fill="none"
          stroke={lightColors.fitness}
          strokeWidth={2.5}
        />

        {/* x-axis date labels */}
        {points.map((p, i) =>
          i % labelStep === 0 || i === n - 1 ? (
            <SvgText
              key={`xl-${i}`}
              x={xFor(i)}
              y={height - 8}
              fontSize={10}
              fill={lightColors.textMuted}
              textAnchor="middle"
            >
              {shortDate(p.test_date)}
            </SvgText>
          ) : null
        )}

        {/* data points (tap to annotate) */}
        {points.map((p, i) => (
          <Circle
            key={`pt-${i}`}
            cx={xFor(i)}
            cy={yFor(p.ftp_watts)}
            r={i === selected ? 5 : 3.5}
            fill={i === selected ? lightColors.fitness : '#fff'}
            stroke={lightColors.fitness}
            strokeWidth={2}
            onPress={() => setSelected(i)}
          />
        ))}
        {/* larger transparent hit areas for easier tapping */}
        {points.map((p, i) => (
          <Circle
            key={`hit-${i}`}
            cx={xFor(i)}
            cy={yFor(p.ftp_watts)}
            r={16}
            fill="transparent"
            onPress={() => setSelected(i)}
          />
        ))}

        {/* annotation tooltip for the selected point */}
        <Rect x={tipX} y={selY - 40} width={tipW} height={30} rx={6} fill={lightColors.text} opacity={0.92} />
        <SvgText x={tipX + tipW / 2} y={selY - 26} fontSize={11} fontWeight="bold" fill="#fff" textAnchor="middle">
          {sel.ftp_watts} W{sel.watts_per_kg != null ? ` · ${sel.watts_per_kg} W/kg` : ''}
        </SvgText>
        <SvgText x={tipX + tipW / 2} y={selY - 14} fontSize={9} fill="#fff" textAnchor="middle" opacity={0.8}>
          {shortDate(sel.test_date)}
        </SvgText>
      </Svg>

      <Text style={styles.caption}>Tap a point to see its value · dashed line shows the trend</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  emptyText: { color: lightColors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  boost: {
    backgroundColor: '#FEF3E6',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  boostText: { color: lightColors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  caption: { color: lightColors.textMuted, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },
});
