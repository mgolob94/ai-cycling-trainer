import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useRideAnalysis, type PowerZone } from '../hooks/useRideAnalysis';
import { useFtp } from '../hooks/useFtp';
import { useKnowledgeLevel } from '../context/KnowledgeLevelContext';
import { useMetricTooltip, type MetricKey } from '../components/metrics/MetricTooltip';
import MultiLineChart from '../components/MultiLineChart';
import PowerCurveChart from '../components/PowerCurveChart';
import AIAnalysisBadge from '../components/AIAnalysisBadge';
import { Text, Card, SectionHeader, Button } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<AppStackParamList, 'RideDetail'>;
type View3 = 'beginner' | 'intermediate' | 'advanced';

const ZONE_COLORS: Record<string, string> = {
  Z1: '#7FB3D5',
  Z2: '#2D7DD2',
  Z3: '#2E9E5B',
  Z4: '#F5A623',
  Z5: '#F97316',
  Z6: '#E2483D',
  Z7: '#A855F7',
};

// Coggan power-zone bounds as fractions of FTP (upper open for the top zone).
const ZONE_FRAC: Record<string, [number, number | null]> = {
  Z1: [0, 0.55],
  Z2: [0.55, 0.75],
  Z3: [0.75, 0.9],
  Z4: [0.9, 1.05],
  Z5: [1.05, 1.2],
  Z6: [1.2, 1.5],
  Z7: [1.5, null],
};

function formatDuration(sec: number | null): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function avgSpeed(distanceKm: number | null, durationSec: number | null): string {
  if (!distanceKm || !durationSec) return '—';
  return `${(distanceKm / (durationSec / 3600)).toFixed(1)} km/h`;
}

// Effort → 1–5 stars + label (beginner-friendly stand-in for raw TSS).
function effortFor(tss: number | null): { stars: number; label: string } {
  if (tss == null) return { stars: 0, label: 'Effort unknown' };
  if (tss <= 50) return { stars: 1, label: 'Easy ride' };
  if (tss <= 100) return { stars: 2, label: 'Moderate effort' };
  if (tss <= 150) return { stars: 3, label: 'Good workout' };
  if (tss <= 200) return { stars: 4, label: 'Tough day' };
  return { stars: 5, label: 'Extremely hard' };
}

function plainSummary(dominant: PowerZone | undefined): string {
  if (!dominant) return 'Ride recorded.';
  const z = dominant.zone;
  const name = dominant.label.toLowerCase();
  if (z === 'Z1' || z === 'Z2') return `A solid aerobic ride — mostly in the ${name} zone.`;
  if (z === 'Z3') return `A steady tempo ride — mostly in the ${name} zone.`;
  if (z === 'Z4') return `A hard threshold session — lots of time at ${name}.`;
  return `A high-intensity ride — significant time in ${name}.`;
}

function zoneWattRange(zone: string, ftp: number | null): string | null {
  if (!ftp) return null;
  const frac = ZONE_FRAC[zone];
  if (!frac) return null;
  const lo = Math.round(frac[0] * ftp);
  return frac[1] == null ? `${lo}+ W` : `${lo}–${Math.round(frac[1] * ftp)} W`;
}

function Stars({ count }: { count: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= count ? 'star' : 'star-outline'}
          size={22}
          color={i <= count ? palette.amber400 : palette.slate200}
        />
      ))}
    </View>
  );
}

export default function RideDetailScreen({ route }: Props) {
  const { stravaId } = route.params;
  const { colors } = useTheme();
  const { analysis, loading, error, regenerate } = useRideAnalysis(stravaId);
  const ftp = useFtp();
  const { level, track } = useKnowledgeLevel();
  const { show } = useMetricTooltip();

  const initialView: View3 = level === 'advanced' ? 'advanced' : level === 'intermediate' ? 'intermediate' : 'beginner';
  const [view, setView] = useState<View3>(initialView);

  const chartWidth = Dimensions.get('window').width - spacing[5] * 2 - spacing[5] * 2;

  const stepTo = (next: View3, trigger?: 'show_more') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setView(next);
    if (trigger) track(trigger);
  };

  // ⓘ: open the metric's explanation sheet AND reveal the advanced view.
  const handleInfo = (metric: MetricKey, value: number | null) => {
    show(metric, value ?? undefined);
    if (view !== 'advanced') stepTo('advanced');
  };

  const ftpWatts = ftp.ftp?.ftp_watts ?? null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="caption">Analyzing your ride…</Text>
          </View>
        ) : error ? (
          <Card variant="default">
            <Text variant="body" color={palette.rose600}>
              {error}
            </Text>
          </Card>
        ) : analysis ? (
          (() => {
            const np = analysis.normalized_power ?? analysis.ride.avg_power_w ?? null;
            const dur = analysis.ride.duration_sec;
            const tss =
              ftpWatts && np && dur ? Math.round(((dur * np * (np / ftpWatts)) / (ftpWatts * 3600)) * 100) : null;
            const effort = effortFor(tss);
            const dominant = [...analysis.zones].sort((a, b) => b.pct - a.pct)[0];
            const showNumbers = view !== 'beginner';
            const showAdvanced = view === 'advanced';
            const powerCurvePoints = Object.entries(analysis.power_curve || {}).map(([d, w]) => ({
              duration_sec: Number(d),
              power_watts: w,
            }));

            return (
              <>
                {/* Always-clear basics */}
                <Card variant="default">
                  <Text variant="heading3" color={colors.textPrimary}>
                    {analysis.ride.ride_date ?? 'Ride'}
                  </Text>
                  <View style={styles.basics}>
                    <Basic label="Distance" value={analysis.ride.distance_km != null ? `${analysis.ride.distance_km.toFixed(1)} km` : '—'} />
                    <Basic label="Duration" value={formatDuration(dur)} />
                    <Basic label="Avg speed" value={avgSpeed(analysis.ride.distance_km, dur)} />
                    <Basic label="Elevation" value={analysis.ride.elevation_m != null ? `${Math.round(analysis.ride.elevation_m)} m` : '—'} />
                  </View>
                </Card>

                {/* Plain-language summary + effort stars */}
                <Card variant="raised">
                  <Text variant="bodyLarge" color={colors.textPrimary} style={styles.summary}>
                    {plainSummary(dominant)}
                  </Text>
                  <View style={styles.effortRow}>
                    <Stars count={effort.stars} />
                    <Text variant="caption" color={colors.textSecondary}>
                      {effort.label}
                    </Text>
                  </View>
                </Card>

                {/* AI insight (always plain language) */}
                <Card variant="default">
                  <View style={styles.aiHeader}>
                    <SectionHeader title="COACH ANALYSIS" />
                    {analysis.ai_analysis.execution_score != null ? (
                      <View style={styles.scoreBadge}>
                        <Text variant="statMd" color={colors.accent}>
                          {analysis.ai_analysis.execution_score}
                        </Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          /10
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <AIAnalysisBadge
                    isCached={!!analysis.ai_analysis._cached}
                    generatedAt={analysis.ai_analysis._generated_at}
                    onRefresh={regenerate}
                  />
                  <Text variant="body" color={colors.textPrimary} style={styles.aiSummary}>
                    {analysis.ai_analysis.ride_summary}
                  </Text>
                  <Text variant="label" color={palette.slate400} style={styles.aiLabel}>
                    NEXT TIME
                  </Text>
                  <Text variant="caption" color={colors.textSecondary} style={styles.aiText}>
                    {analysis.ai_analysis.improvement_tip}
                  </Text>
                </Card>

                {/* Zone distribution (names only for beginners; + Z# otherwise) */}
                <Card variant="default">
                  <SectionHeader title="TIME IN ZONES" />
                  <View style={styles.zoneList}>
                    {analysis.zones.map((z) => {
                      const range = showAdvanced ? zoneWattRange(z.zone, ftpWatts) : null;
                      return (
                        <View key={z.zone} style={styles.zoneRow}>
                          <Text variant="caption" color={colors.textPrimary} style={styles.zoneName}>
                            {showNumbers ? `${z.zone} ${z.label}` : z.label}
                            {range ? <Text variant="caption" color={colors.textTertiary}>{`  ${range}`}</Text> : null}
                          </Text>
                          <View style={[styles.zoneTrack, { backgroundColor: colors.surfaceRaised }]}>
                            <View
                              style={[styles.zoneFill, { width: `${z.pct}%`, backgroundColor: ZONE_COLORS[z.zone] ?? palette.indigo400 }]}
                            />
                          </View>
                          <Text variant="caption" color={colors.textSecondary} style={styles.zonePct}>
                            {z.pct}%
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>

                {/* Intermediate: numeric metrics + W' depletion */}
                {showNumbers ? (
                  <Card variant="default">
                    <SectionHeader title="THE NUMBERS" />
                    <View style={styles.metricGrid}>
                      <MetricBlock label="NP" value={np != null ? `${Math.round(np)}` : '—'} unit="W" metric="np" onInfo={() => handleInfo('np', np)} />
                      <MetricBlock label="VI" value={analysis.variability_index != null ? `${analysis.variability_index}` : '—'} metric="vi" onInfo={() => handleInfo('vi', analysis.variability_index)} />
                      <MetricBlock label="EF" value={analysis.efficiency_factor != null ? `${analysis.efficiency_factor}` : '—'} metric="ef" onInfo={() => handleInfo('ef', analysis.efficiency_factor)} />
                      <MetricBlock label="TSS" value={tss != null ? `${tss}` : '—'} metric="tss" onInfo={() => handleInfo('tss', tss)} />
                    </View>
                    <Text variant="caption" color={colors.textSecondary} style={styles.wprimeLine}>
                      You used {analysis.wprime.w_prime_depletion_percent}% of your anaerobic capacity (W′).
                    </Text>
                  </Card>
                ) : null}

                {/* Advanced: charts + full zone ranges */}
                {showAdvanced ? (
                  <>
                    <Card variant="default">
                      <View style={styles.cardHeadRow}>
                        <SectionHeader title="W′ BALANCE OVER TIME" />
                        <Pressable hitSlop={10} onPress={() => show('wprime', analysis.wprime.w_prime_total)}>
                          <Feather name="info" size={14} color={palette.slate400} />
                        </Pressable>
                      </View>
                      <MultiLineChart
                        width={chartWidth}
                        labels={analysis.wprime.balance_stream.map(() => '')}
                        series={[{ color: '#7D3CFF', values: analysis.wprime.balance_stream }]}
                      />
                      <Text variant="caption" color={colors.textSecondary}>
                        Min {Math.round(analysis.wprime.min_w_prime_balance)} J · {analysis.wprime.w_prime_depletion_percent}% depleted · {analysis.wprime.match_count} matches
                      </Text>
                    </Card>

                    {powerCurvePoints.length ? (
                      <Card variant="default">
                        <SectionHeader title="POWER CURVE" />
                        <PowerCurveChart width={chartWidth} points={powerCurvePoints} />
                      </Card>
                    ) : null}
                  </>
                ) : null}

                {/* Progressive CTA */}
                {view === 'beginner' ? (
                  <Button label="Show details" variant="secondary" onPress={() => stepTo('intermediate', 'show_more')} />
                ) : view === 'intermediate' ? (
                  <View style={styles.ctaRow}>
                    <Button label="Show advanced" variant="ghost" size="sm" onPress={() => stepTo('advanced')} />
                    <Button label="Hide details" variant="ghost" size="sm" onPress={() => stepTo('beginner')} />
                  </View>
                ) : (
                  <Button label="Hide details" variant="ghost" size="sm" onPress={() => stepTo('beginner')} />
                )}
              </>
            );
          })()
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Basic({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.basic}>
      <Text variant="statSm" color={colors.textPrimary}>
        {value}
      </Text>
      <Text variant="label" color={palette.slate400}>
        {label}
      </Text>
    </View>
  );
}

function MetricBlock({
  label,
  value,
  unit,
  onInfo,
}: {
  label: string;
  value: string;
  unit?: string;
  metric: MetricKey;
  onInfo: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.metricBlock}>
      <Text variant="statSm" color={colors.textPrimary}>
        {value}
        {unit ? <Text variant="caption" color={colors.textSecondary}>{` ${unit}`}</Text> : null}
      </Text>
      <View style={styles.metricLabelRow}>
        <Text variant="label" color={palette.slate400}>
          {label}
        </Text>
        <Pressable onPress={onInfo} hitSlop={10} accessibilityLabel="What is this?">
          <Feather name="info" size={12} color={palette.slate400} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[10], gap: spacing[2] },

  basics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[3] },
  basic: { width: '50%', marginBottom: spacing[3], gap: 2 },

  summary: { fontWeight: '600', lineHeight: 24 },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
  starsRow: { flexDirection: 'row', gap: 2 },

  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreBadge: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  aiSummary: { lineHeight: 22, marginTop: spacing[2] },
  aiLabel: { marginTop: spacing[4] },
  aiText: { lineHeight: 20, marginTop: 2 },

  zoneList: { gap: spacing[2], marginTop: spacing[2] },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  zoneName: { flex: 1 },
  zoneTrack: { width: 90, height: 12, borderRadius: radius.sm, overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: radius.sm },
  zonePct: { width: 40, textAlign: 'right' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2] },
  metricBlock: { width: '25%', gap: 2, marginBottom: spacing[2] },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  wprimeLine: { marginTop: spacing[3], lineHeight: 19 },

  cardHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
