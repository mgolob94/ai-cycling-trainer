import { Fragment, useState } from 'react';
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';

import Text from '../ui/Text';
import { palette, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export interface RecoveryHistoryPoint {
  date: string; // YYYY-MM-DD
  recovery_score: number | null;
  hrv_ms: number | null;
  hrv_baseline?: number | null;
  sleep_deep_min?: number | null;
  sleep_rem_min?: number | null;
  sleep_light_min?: number | null;
  sleep_awake_min?: number | null;
  sleep_duration_min?: number | null;
  tss?: number | null;
}

type ViewKey = 'recovery' | 'hrv' | 'sleep' | 'all';
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'recovery', label: 'Recovery' },
  { key: 'hrv', label: 'HRV' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'all', label: 'All' },
];

const HEIGHT = 160;
const PAD = { left: 30, right: 34, top: 10, bottom: 18 };

const SCORE_BANDS = [
  { from: 0, to: 30, color: palette.rose50 },
  { from: 30, to: 50, color: palette.amber50 },
  { from: 50, to: 70, color: palette.slate50 },
  { from: 70, to: 85, color: palette.indigo50 },
  { from: 85, to: 100, color: palette.emerald50 },
];
const STAGE_COLORS = { deep: '#1E40AF', rem: palette.indigo400, light: palette.sky400, awake: palette.rose400 };

function hrvColor(value: number, baseline: number | null | undefined): string {
  if (!baseline) return palette.indigo400;
  const pct = (value - baseline) / baseline;
  if (pct > 0.1) return palette.emerald400;
  if (pct >= -0.1) return palette.indigo400;
  if (pct >= -0.2) return palette.amber400;
  return palette.rose400;
}

function fmtDate(d: string): string {
  return d.slice(5); // MM-DD
}
function fmtDur(min: number | null | undefined): string {
  if (!min) return '—';
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
}

export default function RecoveryHistoryChart({ data }: { data: RecoveryHistoryPoint[] }) {
  const { colors } = useTheme();
  const [view, setView] = useState<ViewKey>('recovery');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = data.length;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const xFor = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const bandW = n > 0 ? plotW / n : 0;

  // --- per-view scales ---
  const yScore = (v: number) => PAD.top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const hrvVals = data.map((d) => d.hrv_ms ?? 0);
  const hrvBaseline = data.find((d) => d.hrv_baseline != null)?.hrv_baseline ?? null;
  const hrvMax = Math.max(1, ...hrvVals, hrvBaseline ?? 0);
  const yHrv = (v: number) => PAD.top + plotH - (v / hrvMax) * plotH;
  const sleepTotals = data.map(
    (d) => (d.sleep_deep_min ?? 0) + (d.sleep_rem_min ?? 0) + (d.sleep_light_min ?? 0) + (d.sleep_awake_min ?? 0)
  );
  const sleepMax = Math.max(480, ...sleepTotals); // at least 8h scale
  const ySleep = (min: number) => PAD.top + plotH - (min / sleepMax) * plotH;
  const tssVals = data.map((d) => d.tss ?? 0);
  const tssMax = Math.max(1, ...tssVals);
  const yTss = (v: number) => PAD.top + plotH - (v / tssMax) * plotH;

  const sel = selected != null ? data[selected] : null;

  const tooltipText = (() => {
    if (!sel) return null;
    const d = fmtDate(sel.date);
    if (view === 'hrv') return `${d}: HRV ${sel.hrv_ms != null ? Math.round(sel.hrv_ms) : '—'} ms${hrvBaseline ? ` (base ${Math.round(hrvBaseline)})` : ''}`;
    if (view === 'sleep') return `${d}: ${fmtDur(sleepTotals[selected!])}`;
    if (view === 'all') return `${d}: Recovery ${sel.recovery_score ?? '—'} · TSS ${Math.round(sel.tss ?? 0)}`;
    return `${d}: Recovery ${sel.recovery_score ?? '—'}`;
  })();

  // Recovery line points (skip nulls).
  const scorePts = data
    .map((d, i) => (d.recovery_score != null ? `${xFor(i)},${yScore(d.recovery_score)}` : null))
    .filter(Boolean)
    .join(' ');

  return (
    <View>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <Pressable
              key={v.key}
              style={[styles.toggle, active && { backgroundColor: colors.textPrimary }]}
              onPress={() => {
                setView(v.key);
                setSelected(null);
              }}
            >
              <Text variant="caption" color={active ? colors.background : colors.textSecondary} style={styles.toggleText}>
                {v.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tooltip */}
      {tooltipText ? (
        <View style={[styles.tooltip, { backgroundColor: colors.surfaceRaised }]}>
          <Text variant="caption" color={colors.textPrimary}>
            {tooltipText}
          </Text>
        </View>
      ) : (
        <Text variant="caption" color={palette.slate400} style={styles.hint}>
          Tap a day for details
        </Text>
      )}

      {/* Chart */}
      <View onLayout={onLayout} style={{ height: HEIGHT }}>
        {width > 0 && n > 0 ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {/* ===== recovery ===== */}
              {view === 'recovery' || view === 'all' ? null : null}
              {view === 'recovery' ? (
                <>
                  {SCORE_BANDS.map((b, i) => (
                    <Rect
                      key={`band-${i}`}
                      x={PAD.left}
                      y={yScore(b.to)}
                      width={plotW}
                      height={yScore(b.from) - yScore(b.to)}
                      fill={b.color}
                    />
                  ))}
                  <Polyline points={scorePts} fill="none" stroke={palette.slate800} strokeWidth={2} />
                  {data.map((d, i) =>
                    d.recovery_score != null ? (
                      <Circle
                        key={`pt-${i}`}
                        cx={xFor(i)}
                        cy={yScore(d.recovery_score)}
                        r={i === n - 1 ? 5 : selected === i ? 4 : 2}
                        fill={i === n - 1 ? palette.slate900 : palette.slate600}
                      />
                    ) : null
                  )}
                </>
              ) : null}

              {/* ===== HRV ===== */}
              {view === 'hrv' ? (
                <>
                  {data.map((d, i) => {
                    if (d.hrv_ms == null) return null;
                    const bw = bandW * 0.6;
                    const y = yHrv(d.hrv_ms);
                    return (
                      <Rect
                        key={`hrv-${i}`}
                        x={xFor(i) - bw / 2}
                        y={y}
                        width={bw}
                        height={PAD.top + plotH - y}
                        rx={2}
                        fill={hrvColor(d.hrv_ms, hrvBaseline)}
                        opacity={selected == null || selected === i ? 1 : 0.5}
                      />
                    );
                  })}
                  {hrvBaseline ? (
                    <Line
                      x1={PAD.left}
                      y1={yHrv(hrvBaseline)}
                      x2={width - PAD.right}
                      y2={yHrv(hrvBaseline)}
                      stroke={colors.textTertiary}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                  ) : null}
                </>
              ) : null}

              {/* ===== sleep ===== */}
              {view === 'sleep' ? (
                <>
                  {data.map((d, i) => {
                    const total = sleepTotals[i];
                    if (!total) return null;
                    const bw = bandW * 0.6;
                    const x = xFor(i) - bw / 2;
                    let cursor = PAD.top + plotH; // bottom up
                    const segs: { color: string; min: number }[] = [
                      { color: STAGE_COLORS.deep, min: d.sleep_deep_min ?? 0 },
                      { color: STAGE_COLORS.rem, min: d.sleep_rem_min ?? 0 },
                      { color: STAGE_COLORS.light, min: d.sleep_light_min ?? 0 },
                      { color: STAGE_COLORS.awake, min: d.sleep_awake_min ?? 0 },
                    ];
                    return (
                      <Fragment key={`sleep-${i}`}>
                        {segs.map((s, si) => {
                          if (!s.min) return null;
                          const h = (s.min / sleepMax) * plotH;
                          cursor -= h;
                          return <Rect key={si} x={x} y={cursor} width={bw} height={h} fill={s.color} />;
                        })}
                        {total < 360 ? (
                          <Rect
                            x={x - 1}
                            y={ySleep(total) - 1}
                            width={bw + 2}
                            height={PAD.top + plotH - ySleep(total) + 1}
                            fill="none"
                            stroke={palette.rose400}
                            strokeWidth={1.5}
                            rx={2}
                          />
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {/* 7h reference line */}
                  <Line
                    x1={PAD.left}
                    y1={ySleep(420)}
                    x2={width - PAD.right}
                    y2={ySleep(420)}
                    stroke={colors.textTertiary}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <SvgText x={width - PAD.right + 2} y={ySleep(420) + 3} fontSize={9} fill={colors.textTertiary}>
                    7h
                  </SvgText>
                </>
              ) : null}

              {/* ===== all (recovery line + TSS bars, dual axis) ===== */}
              {view === 'all' ? (
                <>
                  {data.map((d, i) => {
                    if (!d.tss) return null;
                    const bw = bandW * 0.5;
                    const y = yTss(d.tss);
                    return (
                      <Rect
                        key={`tss-${i}`}
                        x={xFor(i) - bw / 2}
                        y={y}
                        width={bw}
                        height={PAD.top + plotH - y}
                        rx={2}
                        fill={palette.slate200}
                        opacity={selected == null || selected === i ? 1 : 0.5}
                      />
                    );
                  })}
                  <Polyline points={scorePts} fill="none" stroke={palette.indigo400} strokeWidth={2} />
                  {/* left axis: recovery 0/50/100 */}
                  {[0, 50, 100].map((v) => (
                    <SvgText key={`l-${v}`} x={PAD.left - 4} y={yScore(v) + 3} fontSize={9} fill={palette.indigo400} textAnchor="end">
                      {v}
                    </SvgText>
                  ))}
                  {/* right axis: TSS max */}
                  <SvgText x={width - PAD.right + 4} y={yTss(tssMax) + 6} fontSize={9} fill={palette.slate400}>
                    {Math.round(tssMax)}
                  </SvgText>
                  <SvgText x={width - PAD.right + 4} y={PAD.top + plotH} fontSize={9} fill={palette.slate400}>
                    TSS
                  </SvgText>
                </>
              ) : null}
            </Svg>

            {/* Touch overlay: one column per day */}
            <View style={[styles.touchRow, { left: PAD.left, right: PAD.right, top: PAD.top, height: plotH }]}>
              {data.map((d, i) => (
                <Pressable key={`t-${i}`} style={styles.touchCol} onPress={() => setSelected(selected === i ? null : i)} />
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: spacing[1], marginBottom: spacing[3] },
  toggle: { flex: 1, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: palette.slate200, alignItems: 'center' },
  toggleText: { fontWeight: '700', textTransform: 'none', letterSpacing: 0, fontSize: 12 },
  tooltip: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[1], marginBottom: spacing[2] },
  hint: { marginBottom: spacing[2] },
  touchRow: { position: 'absolute', flexDirection: 'row' },
  touchCol: { flex: 1 },
});
