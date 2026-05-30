import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useRideAnalysis, type PowerZone } from '../hooks/useRideAnalysis';
import MultiLineChart from '../components/MultiLineChart';
import type { AppStackParamList } from '../navigation/types';
import { lightColors, spacing, radius, fontSize } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'RideDetail'>;

const ZONE_COLORS: Record<string, string> = {
  Z1: '#7FB3D5',
  Z2: '#2D7DD2',
  Z3: '#2E9E5B',
  Z4: '#F5A623',
  Z5: '#E2483D',
  Z6: '#7D3CFF',
};

const FATIGUE_COLOR: Record<string, string> = {
  low: lightColors.form,
  medium: '#F5A623',
  high: lightColors.fatigue,
};

function formatDuration(sec: number | null): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ZoneBars({ zones }: { zones: PowerZone[] }) {
  const maxPct = Math.max(...zones.map((z) => z.pct), 1);
  return (
    <View style={{ gap: spacing.sm }}>
      {zones.map((z) => (
        <View key={z.zone} style={styles.zoneRow}>
          <Text style={styles.zoneLabel}>{z.zone}</Text>
          <View style={styles.zoneTrack}>
            <View
              style={[
                styles.zoneFill,
                { width: `${(z.pct / maxPct) * 100}%`, backgroundColor: ZONE_COLORS[z.zone] ?? lightColors.primary },
              ]}
            />
          </View>
          <Text style={styles.zonePct}>{z.pct}%</Text>
        </View>
      ))}
    </View>
  );
}

export default function RideDetailScreen({ route }: Props) {
  const { stravaId } = route.params;
  const { analysis, loading, error } = useRideAnalysis(stravaId);

  const chartWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={lightColors.primary} />
            <Text style={styles.muted}>Analyzing your ride…</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : analysis ? (
          <>
            {/* Stats */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{analysis.ride.ride_date ?? 'Ride'}</Text>
              <View style={styles.statsGrid}>
                <Stat label="Distance" value={analysis.ride.distance_km != null ? `${analysis.ride.distance_km.toFixed(1)} km` : '—'} />
                <Stat label="Duration" value={formatDuration(analysis.ride.duration_sec)} />
                <Stat label="Elevation" value={analysis.ride.elevation_m != null ? `${Math.round(analysis.ride.elevation_m)} m` : '—'} />
                <Stat label="Avg power" value={analysis.ride.avg_power_w != null ? `${Math.round(analysis.ride.avg_power_w)} W` : '—'} />
                <Stat label="Norm. power" value={analysis.normalized_power != null ? `${analysis.normalized_power} W` : '—'} />
                <Stat label="Avg HR" value={analysis.ride.avg_heart_rate != null ? `${Math.round(analysis.ride.avg_heart_rate)} bpm` : '—'} />
                <Stat label="VI" value={analysis.variability_index != null ? `${analysis.variability_index}` : '—'} />
                <Stat label="EF" value={analysis.efficiency_factor != null ? `${analysis.efficiency_factor}` : '—'} />
              </View>
            </View>

            {/* AI analysis */}
            <View style={styles.card}>
              <View style={styles.aiHeader}>
                <Text style={styles.cardLabel}>COACH ANALYSIS</Text>
                {analysis.ai_analysis.execution_score != null ? (
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreValue}>{analysis.ai_analysis.execution_score}</Text>
                    <Text style={styles.scoreOutOf}>/10</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.aiSummary}>{analysis.ai_analysis.ride_summary}</Text>

              <Text style={styles.aiSectionLabel}>Power zones</Text>
              <Text style={styles.aiText}>{analysis.ai_analysis.power_zones_feedback}</Text>
              <Text style={styles.aiSectionLabel}>Top moment</Text>
              <Text style={styles.aiText}>{analysis.ai_analysis.top_moment}</Text>
              <Text style={styles.aiSectionLabel}>Next time</Text>
              <Text style={styles.aiText}>{analysis.ai_analysis.improvement_tip}</Text>

              <View style={styles.fatigueRow}>
                <Text style={styles.aiSectionLabel}>Fatigue impact</Text>
                <View
                  style={[
                    styles.fatigueBadge,
                    { backgroundColor: FATIGUE_COLOR[analysis.ai_analysis.fatigue_impact] ?? lightColors.textMuted },
                  ]}
                >
                  <Text style={styles.fatigueText}>{analysis.ai_analysis.fatigue_impact}</Text>
                </View>
              </View>
            </View>

            {/* W' balance */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>W' balance</Text>
              <Text style={styles.muted}>
                Min {Math.round(analysis.wprime.min_w_prime_balance)} J · {analysis.wprime.w_prime_depletion_percent}% depleted · {analysis.wprime.match_count} matches
              </Text>
              <MultiLineChart
                width={chartWidth}
                labels={analysis.wprime.balance_stream.map(() => '')}
                series={[{ color: '#7D3CFF', values: analysis.wprime.balance_stream }]}
              />
            </View>

            {/* Power zone distribution */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Time in power zones</Text>
              <ZoneBars zones={analysis.zones} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  muted: { color: lightColors.textMuted, fontSize: fontSize.sm },
  error: { color: lightColors.fatigue, fontSize: fontSize.md },

  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  cardTitle: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  cardLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '25%', marginBottom: spacing.md },
  statValue: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '700' },
  statLabel: { color: lightColors.textMuted, fontSize: 11, marginTop: 2 },

  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreBadge: { flexDirection: 'row', alignItems: 'flex-end' },
  scoreValue: { color: lightColors.primary, fontSize: 32, fontWeight: '800', lineHeight: 34 },
  scoreOutOf: { color: lightColors.textMuted, fontSize: fontSize.sm, marginBottom: 4, marginLeft: 2 },
  aiSummary: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
  aiSectionLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.md },
  aiText: { color: lightColors.text, fontSize: fontSize.sm, lineHeight: 20, marginTop: 2 },
  fatigueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  fatigueBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  fatigueText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700', textTransform: 'capitalize' },

  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  zoneLabel: { color: lightColors.text, fontSize: fontSize.sm, fontWeight: '700', width: 28 },
  zoneTrack: { flex: 1, height: 14, backgroundColor: lightColors.background, borderRadius: radius.sm, overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: radius.sm },
  zonePct: { color: lightColors.textMuted, fontSize: fontSize.sm, width: 44, textAlign: 'right' },
});
