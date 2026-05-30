import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';

import { api, apiOrigin, ApiResponse } from '../services/api';
import { useWeeklyMetrics, type WeeklyMetric } from '../hooks/useWeeklyMetrics';
import { lightColors, spacing, radius, fontSize } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type MetricKey = 'tss' | 'distance' | 'elevation' | 'rides';
interface MetricDef {
  key: MetricKey;
  label: string;
  get: (w: WeeklyMetric) => number;
  fmt: (n: number) => string;
}
const METRICS: MetricDef[] = [
  { key: 'tss', label: 'TSS', get: (w) => w.tss, fmt: (n) => `${Math.round(n)}` },
  { key: 'distance', label: 'Distance', get: (w) => w.total_distance_km, fmt: (n) => `${Math.round(n)}km` },
  { key: 'elevation', label: 'Elevation', get: (w) => w.total_elevation_m, fmt: (n) => `${Math.round(n)}m` },
  { key: 'rides', label: 'Rides', get: (w) => w.ride_count, fmt: (n) => `${n}` },
];

function AiSummaryCard({ weeks }: { weeks: WeeklyMetric[] }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!weeks.length || requested.current) return;
    requested.current = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.post<ApiResponse<{ summary: string }>>(
          `${apiOrigin}/ai/weekly-summary`,
          { weeks: weeks.slice(-4) }
        );
        setSummary(data.data?.summary ?? null);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Could not load summary.');
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [weeks]);

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>COACH'S TAKE</Text>
      {loading ? (
        <ActivityIndicator color={lightColors.primary} style={{ marginVertical: spacing.sm }} />
      ) : summary ? (
        <Text style={styles.summaryText}>{summary}</Text>
      ) : (
        <Text style={styles.summaryMuted}>{error ?? 'No summary available yet.'}</Text>
      )}
    </View>
  );
}

function BarChart({ weeks, metric }: { weeks: WeeklyMetric[]; metric: MetricDef }) {
  const width = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2;
  const height = 240;
  const PAD_TOP = 30;
  const PAD_BOTTOM = 42;
  const PAD_X = 6;

  const values = weeks.map(metric.get);
  const max = Math.max(...values, 1);
  const bestIndex = values.indexOf(Math.max(...values));
  const hasData = Math.max(...values) > 0;

  const plotW = width - PAD_X * 2;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + plotH;
  const n = weeks.length;
  const slot = n > 0 ? plotW / n : plotW;
  const barWidth = slot * 0.5;
  const centerX = (i: number) => PAD_X + slot * i + slot / 2;

  function pctChange(i: number): { text: string; color: string } {
    if (i === 0) return { text: '', color: lightColors.textMuted };
    const prev = values[i - 1];
    const cur = values[i];
    if (prev === 0) return { text: '—', color: lightColors.textMuted };
    const pct = ((cur - prev) / prev) * 100;
    const sign = pct > 0 ? '+' : '';
    const color = pct > 0 ? lightColors.form : pct < 0 ? lightColors.fatigue : lightColors.textMuted;
    return { text: `${sign}${Math.round(pct)}%`, color };
  }

  return (
    <Svg width={width} height={height}>
      <Line x1={PAD_X} y1={baselineY} x2={width - PAD_X} y2={baselineY} stroke={lightColors.border} strokeWidth={1} />
      {weeks.map((w, i) => {
        const v = values[i];
        const barH = hasData ? (v / max) * plotH : 0;
        const top = baselineY - barH;
        const isBest = hasData && i === bestIndex;
        const change = pctChange(i);
        return (
          <G key={w.week_start}>
            <Rect
              x={centerX(i) - barWidth / 2}
              y={top}
              width={barWidth}
              height={barH}
              rx={3}
              fill={lightColors.primary}
              opacity={isBest ? 1 : 0.45}
            />
            <SvgText x={centerX(i)} y={top - 6} fontSize={10} fill={lightColors.text} textAnchor="middle">
              {metric.fmt(v)}
            </SvgText>
            {isBest ? (
              <SvgText x={centerX(i)} y={top - 18} fontSize={13} fill={lightColors.gold} textAnchor="middle">
                ★
              </SvgText>
            ) : null}
            <SvgText x={centerX(i)} y={baselineY + 14} fontSize={9} fill={lightColors.textMuted} textAnchor="middle">
              {shortDate(w.week_start)}
            </SvgText>
            <SvgText x={centerX(i)} y={baselineY + 28} fontSize={9} fill={change.color} textAnchor="middle">
              {change.text}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export default function WeeklyComparisonScreen() {
  const { weeks, loading, error } = useWeeklyMetrics();
  const [metricKey, setMetricKey] = useState<MetricKey>('tss');
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const last8 = weeks.slice(-8);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <AiSummaryCard weeks={weeks} />

        <View style={styles.toggleRow}>
          {METRICS.map((m) => {
            const active = m.key === metricKey;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.toggle, active && styles.toggleActive]}
                activeOpacity={0.8}
                onPress={() => setMetricKey(m.key)}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last {last8.length} weeks · {metric.label}</Text>
          {loading ? (
            <ActivityIndicator color={lightColors.primary} style={{ marginVertical: spacing.xl }} />
          ) : last8.length === 0 ? (
            <Text style={styles.summaryMuted}>No weekly data yet — sync some rides.</Text>
          ) : (
            <BarChart weeks={last8} metric={metric} />
          )}
          <Text style={styles.caption}>★ best week · % change vs previous week</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },

  summaryCard: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.primary,
    padding: spacing.lg,
  },
  summaryLabel: { color: lightColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  summaryText: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22 },
  summaryMuted: { color: lightColors.textMuted, fontSize: fontSize.sm },

  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: lightColors.primary, borderColor: lightColors.primary },
  toggleText: { color: lightColors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  toggleTextActive: { color: '#fff' },

  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  cardTitle: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.sm },
  caption: { color: lightColors.textMuted, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },
  error: { color: lightColors.fatigue, fontSize: fontSize.sm },
});
