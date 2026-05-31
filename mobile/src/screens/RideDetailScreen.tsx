import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Pressable,
  LayoutAnimation,
  Animated,
  Easing,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useRideAnalysis } from '../hooks/useRideAnalysis';
import { useRideFeedback } from '../hooks/useRideFeedback';
import { useFtp } from '../hooks/useFtp';
import { useKnowledgeLevel } from '../context/KnowledgeLevelContext';
import { useMetricTooltip, type MetricKey } from '../components/metrics/MetricTooltip';
import { useAuthStore } from '../store/useAuthStore';
import MultiLineChart from '../components/MultiLineChart';
import PowerCurveChart from '../components/PowerCurveChart';
import PostWorkoutSurvey from '../components/workout/PostWorkoutSurvey';
import { Text } from '../components/ui';
import { zoneColors, spacing, radius } from '../theme/tokens';
import { DARK_TOKENS } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<AppStackParamList, 'RideDetail'>;

// Activity detail is intentionally always dark (Strava-style), regardless of the
// app theme — numbers pop on black, nothing competes.
const c = DARK_TOKENS;

function formatDuration(sec: number | null): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function avgSpeed(distanceKm: number | null, durationSec: number | null): string {
  if (!distanceKm || !durationSec) return '—';
  return `${(distanceKm / (durationSec / 3600)).toFixed(1)}`;
}

// "1,240" — thousands separator for big hero numbers.
function grouped(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// Effort stars (1–5) from TSS — the beginner stand-in for raw training load.
function effortFor(tss: number): { stars: number; label: string } {
  if (tss <= 50) return { stars: 1, label: 'Easy ride' };
  if (tss <= 100) return { stars: 2, label: 'Moderate effort' };
  if (tss <= 150) return { stars: 3, label: 'Good workout' };
  if (tss <= 200) return { stars: 4, label: 'Tough day' };
  return { stars: 5, label: 'Extremely hard' };
}

// Plain-language one-liner from the ride's dominant power zone (beginner view).
function plainSummary(zones: { zone: string; label: string; pct: number }[]): string {
  if (!zones.length) return 'Ride recorded.';
  const d = [...zones].sort((a, b) => b.pct - a.pct)[0];
  const name = d.label.toLowerCase();
  if (d.zone === 'Z1' || d.zone === 'Z2') return `A solid aerobic ride — mostly in the ${name} zone.`;
  if (d.zone === 'Z3') return `A steady tempo ride — mostly in the ${name} zone.`;
  if (d.zone === 'Z4') return `A hard threshold session — lots of time at ${name}.`;
  return `A high-intensity ride — significant time in ${name}.`;
}

function Stars({ count }: { count: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= count ? 'star' : 'star-outline'} size={20} color={i <= count ? c.warning : c.textDim} />
      ))}
    </View>
  );
}

export default function RideDetailScreen({ route }: Props) {
  const { stravaId } = route.params;
  const { analysis, loading, error } = useRideAnalysis(stravaId);
  const { feedback, loading: feedbackLoading, refetch: refetchFeedback } = useRideFeedback(stravaId);
  const userId = useAuthStore((s) => s.userId);
  const ftp = useFtp();
  const { level, config, track } = useKnowledgeLevel();
  const { show } = useMetricTooltip();

  // Progressive disclosure: beginner = plain language + effort stars + zone names;
  // intermediate = + numeric stat cards + zone numbers; advanced = + W′/power-curve
  // (shown by default for advanced via config.defaultExpanded).
  const showNumbers = level !== 'beginner';
  const [showAdvanced, setShowAdvanced] = useState(config.defaultExpanded);
  const [surveyOpen, setSurveyOpen] = useState(false);

  // Entrance: content slides up 20px + fades in once the analysis is ready.
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading && analysis) {
      entrance.setValue(0);
      Animated.timing(entrance, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [loading, analysis, entrance]);
  const entranceStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };

  const ftpWatts = ftp.ftp?.ftp_watts ?? null;
  const chartWidth = Dimensions.get('window').width - spacing[5] * 2;

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAdvanced((v) => {
      if (!v) track('show_more');
      return !v;
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.green} />
            <Text variant="caption" color={c.textSecondary}>
              Analyzing your ride…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text variant="body" color={c.danger}>
              {error}
            </Text>
          </View>
        ) : analysis ? (
          (() => {
            const np = analysis.normalized_power ?? analysis.ride.avg_power_w ?? null;
            const dur = analysis.ride.duration_sec;
            const tss =
              ftpWatts && np && dur ? Math.round(((dur * np * (np / ftpWatts)) / (ftpWatts * 3600)) * 100) : null;
            const workKj = analysis.ride.avg_power_w && dur ? Math.round((analysis.ride.avg_power_w * dur) / 1000) : null;
            const aiScore = analysis.ai_analysis.execution_score;
            const visibleZones = analysis.zones.filter((z) => z.pct >= 5);
            const powerCurvePoints = Object.entries(analysis.power_curve || {}).map(([d, w]) => ({
              duration_sec: Number(d),
              power_watts: w,
            }));

            return (
              <Animated.View style={[styles.animWrap, entranceStyle]}>
                {/* Date / context line */}
                <Text variant="label" color={c.textDim} style={styles.dateLine}>
                  {analysis.ride.ride_date ?? 'Activity'}
                </Text>

                {/* HERO STATS — full bleed, no card; numbers count up on entry */}
                <View style={styles.heroRow}>
                  <HeroStat value={analysis.ride.distance_km} format={(n) => n.toFixed(1)} label="KM" />
                  <View style={styles.vDivider} />
                  {showNumbers ? (
                    <HeroStat value={np} format={(n) => `${Math.round(n)}`} label="W NP" />
                  ) : (
                    <HeroStat value={dur} format={(n) => formatDuration(Math.round(n))} label="TIME" />
                  )}
                  <View style={styles.vDivider} />
                  <HeroStat value={analysis.ride.elevation_m} format={(n) => grouped(n)} label="M ↑" />
                </View>

                {showNumbers ? (
                  /* SECONDARY STATS — 2 rows of 3 (intermediate + advanced) */
                  <View style={styles.secondaryGrid}>
                    <SecStat value={formatDuration(dur)} label="TIME" />
                    <SecStat value={avgSpeed(analysis.ride.distance_km, dur)} label="AVG KM/H" />
                    <SecStat value={analysis.ride.avg_heart_rate != null ? `${Math.round(analysis.ride.avg_heart_rate)}` : '—'} label="BPM" />
                    <SecStat
                      value={analysis.variability_index != null ? `${analysis.variability_index}` : '—'}
                      label="VI"
                      onInfo={() => show('vi', analysis.variability_index ?? undefined)}
                    />
                    <SecStat value={aiScore != null ? `${aiScore}` : '—'} label="AI SCORE" />
                    <SecStat value={workKj != null ? `${grouped(workKj)}` : '—'} label="KJ WORK" />
                  </View>
                ) : (
                  /* PLAIN SUMMARY + EFFORT STARS (beginner) */
                  <View style={styles.beginnerBlock}>
                    <Text variant="bodyLarge" color={c.textPrimary} style={styles.summary}>
                      {plainSummary(analysis.zones)}
                    </Text>
                    {tss != null ? (
                      <View style={styles.effortRow}>
                        <Stars count={effortFor(tss).stars} />
                        <Text variant="caption" color={c.textSecondary}>
                          {effortFor(tss).label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* AI COACH INSIGHT — plain text, green prefix, no box */}
                <View style={[styles.section, { borderTopColor: c.border }]}>
                  <Text variant="label" color={c.green}>
                    COACH
                  </Text>
                  <Text variant="body" color={c.textPrimary} style={styles.coachText}>
                    {analysis.ai_analysis.ride_summary}
                  </Text>
                  {analysis.ai_analysis.improvement_tip ? (
                    <>
                      <Text variant="label" color={c.textDim} style={styles.nextLabel}>
                        NEXT TIME
                      </Text>
                      <Text variant="caption" color={c.textSecondary} style={styles.coachText}>
                        {analysis.ai_analysis.improvement_tip}
                      </Text>
                    </>
                  ) : null}
                </View>

                {/* ZONE DISTRIBUTION */}
                <View style={[styles.section, { borderTopColor: c.border }]}>
                  <Text variant="label" color={c.textDim}>
                    TIME IN ZONES
                  </Text>
                  <View style={styles.zoneBar}>
                    {analysis.zones.map((z) => (
                      <View
                        key={z.zone}
                        style={{ flex: Math.max(z.pct, 0.01), backgroundColor: zoneColors[z.zone.toLowerCase() as keyof typeof zoneColors] ?? c.green }}
                      />
                    ))}
                  </View>
                  <View style={styles.zoneLegend}>
                    {visibleZones.map((z) => (
                      <View key={z.zone} style={styles.zoneLegendItem}>
                        <View style={[styles.zoneDot, { backgroundColor: zoneColors[z.zone.toLowerCase() as keyof typeof zoneColors] ?? c.green }]} />
                        <Text variant="caption" color={c.textPrimary} style={styles.zoneLegendText}>
                          {showNumbers ? `${z.zone} ${z.pct}%` : z.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* WEEK CONTEXT — training load from this ride (numbers users) */}
                {showNumbers && tss != null ? (
                  <View style={[styles.section, { borderTopColor: c.border }]}>
                    <Text variant="label" color={c.textDim}>
                      TRAINING LOAD
                    </Text>
                    <View style={styles.loadRow}>
                      <Text variant="stat" color={c.textPrimary} style={styles.loadValue}>
                        {tss}
                      </Text>
                      <Text variant="label" color={c.textDim} style={styles.loadUnit}>
                        TSS
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* POST-WORKOUT COACH FEEDBACK (the survey loop) */}
                <View style={[styles.section, { borderTopColor: c.border }]}>
                  <Text variant="label" color={c.green}>
                    AFTER THIS RIDE
                  </Text>
                  {feedbackLoading ? null : feedback?.coach_feedback ? (
                    <Text variant="body" color={c.textSecondary} style={styles.coachText}>
                      {feedback.coach_feedback}
                    </Text>
                  ) : feedback?.completion_status ? (
                    <Text variant="caption" color={c.textSecondary} style={styles.coachText}>
                      Your coach is reviewing this ride…
                    </Text>
                  ) : (
                    <Pressable onPress={() => setSurveyOpen(true)}>
                      <Text variant="caption" color={c.textDim} style={styles.coachText}>
                        Rate this ride to get coach feedback →
                      </Text>
                    </Pressable>
                  )}
                </View>

                {showNumbers ? (
                <>
                {/* ADVANCED — W′ balance + power curve, progressively disclosed */}
                {showAdvanced ? (
                  <>
                    <View style={[styles.section, { borderTopColor: c.border }]}>
                      <View style={styles.advHead}>
                        <Text variant="label" color={c.textDim}>
                          W′ BALANCE
                        </Text>
                        <Pressable hitSlop={10} onPress={() => show('wprime', analysis.wprime.w_prime_total)}>
                          <Feather name="info" size={14} color={c.textDim} />
                        </Pressable>
                      </View>
                      <MultiLineChart
                        width={chartWidth}
                        labels={analysis.wprime.balance_stream.map(() => '')}
                        series={[{ color: '#A855F7', values: analysis.wprime.balance_stream }]}
                      />
                      <Text variant="caption" color={c.textSecondary}>
                        Min {Math.round(analysis.wprime.min_w_prime_balance)} J · {analysis.wprime.w_prime_depletion_percent}% depleted · {analysis.wprime.match_count} matches
                      </Text>
                    </View>

                    {powerCurvePoints.length ? (
                      <View style={[styles.section, { borderTopColor: c.border }]}>
                        <Text variant="label" color={c.textDim}>
                          POWER CURVE
                        </Text>
                        <PowerCurveChart width={chartWidth} points={powerCurvePoints} />
                      </View>
                    ) : null}
                  </>
                ) : null}

                <Pressable style={styles.advToggle} onPress={toggleAdvanced} hitSlop={8}>
                  <Text variant="label" color={c.green}>
                    {showAdvanced ? 'HIDE DETAILS' : 'SHOW ADVANCED'}
                  </Text>
                  <Feather name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={c.green} />
                </Pressable>
                </>
                ) : null}
              </Animated.View>
            );
          })()
        ) : null}
      </ScrollView>

      <PostWorkoutSurvey
        visible={surveyOpen}
        userId={userId ?? undefined}
        stravaActivityId={stravaId}
        rideTitle={analysis?.ride.ride_date ? `${analysis.ride.ride_date} ride` : 'Your ride'}
        distanceKm={analysis?.ride.distance_km ?? null}
        workoutDate={analysis?.ride.ride_date ?? undefined}
        onDone={() => {
          setSurveyOpen(false);
          refetchFeedback();
        }}
      />
    </SafeAreaView>
  );
}

// Number that counts from 0 → target over 600ms (easeOutQuart) — fast start,
// smooth stop, no bounce. Drives the hero stats on entry.
function CountUp({ value, format, style }: { value: number; format: (n: number) => string; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(() => format(0));
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(format(v)));
    Animated.timing(anim, { toValue: value, duration: 600, easing: Easing.out(Easing.poly(4)), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Text variant="stat" color={c.textPrimary} style={style}>
      {display}
    </Text>
  );
}

// Hero number — BarlowCondensed-Black, oversized, with an uppercase unit label.
function HeroStat({ value, format, label }: { value: number | null; format: (n: number) => string; label: string }) {
  return (
    <View style={styles.heroStat}>
      {value != null ? (
        <CountUp value={value} format={format} style={styles.heroValue} />
      ) : (
        <Text variant="stat" color={c.textPrimary} style={styles.heroValue}>
          —
        </Text>
      )}
      <Text variant="label" color={c.textDim}>
        {label}
      </Text>
    </View>
  );
}

// Secondary stat — smaller condensed number, optional ⓘ that opens a tooltip.
function SecStat({ value, label, onInfo }: { value: string; label: string; onInfo?: () => void }) {
  return (
    <View style={styles.secStat}>
      <Text variant="statMd" color={c.textPrimary}>
        {value}
      </Text>
      <Pressable style={styles.secLabelRow} disabled={!onInfo} onPress={onInfo} hitSlop={8}>
        <Text variant="label" color={c.textDim}>
          {label}
        </Text>
        {onInfo ? <Feather name="info" size={11} color={c.textDim} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[12], gap: spacing[5] },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[16], gap: spacing[2] },
  animWrap: { gap: spacing[5] },

  dateLine: { marginBottom: -spacing[2] },

  // Hero
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroValue: { fontSize: 50, lineHeight: 54 },
  vDivider: { width: 1, alignSelf: 'stretch', backgroundColor: c.border, marginVertical: spacing[2] },

  // Secondary grid
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  secStat: { width: '33.33%', alignItems: 'center', paddingVertical: spacing[3], gap: 2 },
  secLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Beginner: plain summary + effort stars
  beginnerBlock: { gap: spacing[3] },
  summary: { lineHeight: 24, fontWeight: '600' },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  starsRow: { flexDirection: 'row', gap: 2 },

  // Sections
  section: { borderTopWidth: 1, paddingTop: spacing[4], gap: spacing[2] },
  coachText: { lineHeight: 22 },
  nextLabel: { marginTop: spacing[2] },

  // Zones
  zoneBar: { flexDirection: 'row', height: 8, width: '100%', overflow: 'hidden', marginTop: spacing[1] },
  zoneLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] },
  zoneLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoneDot: { width: 8, height: 8, borderRadius: radius.full },
  zoneLegendText: {},

  // Training load
  loadRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  loadValue: { fontSize: 40, lineHeight: 44 },
  loadUnit: { marginBottom: spacing[2] },

  // Advanced
  advHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[3] },
});
