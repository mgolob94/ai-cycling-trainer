import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Pressable,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { useProfile } from '../hooks/useProfile';
import { useWeeklyMetrics } from '../hooks/useWeeklyMetrics';
import { useFtp } from '../hooks/useFtp';
import { useRiderProfile } from '../hooks/useRiderProfile';
import { usePowerCurve } from '../hooks/usePowerCurve';
import { useWeekAnalysis } from '../hooks/useWeekAnalysis';
import { useRecommendations } from '../hooks/useRecommendations';
import { usePersonalRecords } from '../hooks/usePersonalRecords';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useNudges } from '../hooks/useNudges';
import { useKnowledgeLevel } from '../context/KnowledgeLevelContext';
import type { KnowledgeLevel } from '../services/userLevel';
import {
  interpretCTL,
  interpretATL,
  interpretTSB,
  interpretFTP,
  interpretWeeklyTSS,
} from '../services/metricsInterpreter';
import PowerCurveChart from '../components/PowerCurveChart';
import FTPChart from '../components/FTPChart';
import AIAnalysisBadge from '../components/AIAnalysisBadge';
import { Text, Card, Badge, SectionHeader, Button, SkeletonLoader, Emoji } from '../components/ui';
import MetricTooltip, { useMetricTooltip } from '../components/metrics/MetricTooltip';
import GoalsSection from '../components/goals/GoalsSection';
import { scheduleWeeklySummary } from '../services/notifications';
import { palette, spacing, radius } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { AppStackParamList } from '../navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<AppStackParamList>;
type BadgeColor = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

const LEVELS: KnowledgeLevel[] = ['beginner', 'intermediate', 'advanced'];

function riderBadgeColor(wkg: number | null): BadgeColor {
  if (wkg == null) return 'default';
  if (wkg < 2.0) return 'default';
  if (wkg < 3.0) return 'sky';
  if (wkg < 4.0) return 'indigo';
  if (wkg < 5.0) return 'emerald';
  return 'amber';
}

const RECORD_LABELS: Record<string, string> = {
  best_5min_power: '5 min power',
  best_20min_power: '20 min power',
  best_60min_power: '1 hr power',
  longest_ride_km: 'Longest ride',
  most_elevation_m: 'Most elevation',
};

function trendWord(delta: number): string {
  if (delta > 1) return 'rising';
  if (delta < -1) return 'dropping';
  return 'steady';
}

export default function ProgressScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useThemeColors();
  const profile = useProfile();
  const metrics = useWeeklyMetrics();
  const ftp = useFtp();
  const rider = useRiderProfile();
  const pdc = usePowerCurve();
  const week = useWeekAnalysis();
  const recs = useRecommendations();
  const prs = usePersonalRecords();
  const sync = useSyncStatus();
  const { low } = useNudges();
  const { level, setLevel, track } = useKnowledgeLevel();
  const { show } = useMetricTooltip();

  const [pdcRange, setPdcRange] = useState<'alltime' | '90d' | '30d'>('alltime');
  const [showFtpChart, setShowFtpChart] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  // Screen view level — follows the global knowledge level, overridable here.
  const [viewLevel, setViewLevel] = useState<KnowledgeLevel>(level);
  useEffect(() => {
    setViewLevel(level);
  }, [level]);

  const showNumbers = viewLevel !== 'beginner';
  const showAdvanced = viewLevel === 'advanced';

  const weeks = metrics.weeks;
  const current = weeks[weeks.length - 1];

  useEffect(() => {
    if (current) scheduleWeeklySummary(current.total_distance_km, current.tss).catch(() => {});
  }, [current]);

  const refreshing = profile.loading || metrics.loading || ftp.loading || pdc.loading || prs.loading;
  const onRefresh = () => {
    profile.refresh();
    metrics.refresh();
    ftp.refresh();
    rider.refresh();
    pdc.refresh();
    week.refresh();
    recs.refresh();
    prs.refresh();
    sync.refreshNow();
  };

  const chartWidth = Dimensions.get('window').width - spacing[5] * 2 - spacing[5] * 2;
  const pdcData = pdcRange === 'alltime' ? pdc.alltime : pdcRange === '90d' ? pdc.last90 : pdc.last30;

  // FTP interpretation.
  const ftpWatts = ftp.ftp?.ftp_watts ?? 0;
  const weightKg = profile.profile?.weight_kg ?? 0;
  const ftpHist = ftp.history;
  const prevFtp = ftpHist.length >= 2 ? ftpHist[ftpHist.length - 2].ftp_watts : null;
  const ftpInfo = interpretFTP(ftpWatts, weightKg, prevFtp);
  const badgeColor = riderBadgeColor(ftpInfo.wattsPerKg || null);
  const ftpDelta = prevFtp != null && ftp.ftp ? ftp.ftp.ftp_watts - prevFtp : null;

  const ftpStale =
    !ftp.ftp?.test_date ||
    Date.now() - new Date(`${ftp.ftp.test_date}T00:00:00`).getTime() > 42 * 24 * 3600 * 1000;

  // Training-load interpretation.
  const ctl = current?.ctl ?? 0;
  const atl = current?.atl ?? 0;
  const tsb = current?.tsb ?? 0;
  const prior4 = weeks.length >= 5 ? weeks[weeks.length - 5] : null;
  const priorWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  const ctlTrend = prior4 ? ctl - prior4.ctl : 0;
  const atlTrend = priorWeek ? atl - priorWeek.atl : 0;
  const ctlInfo = interpretCTL(ctl, ctlTrend);
  const atlInfo = interpretATL(atl, atlTrend, ctl);
  const tsbInfo = interpretTSB(tsb);

  const synced = sync.connected && !sync.syncError && !sync.newActivitiesAvailable;
  const tssWeeks = weeks.slice(-5);
  const maxTss = Math.max(1, ...tssWeeks.map((w) => w.tss));
  const avgTss = weeks.length ? weeks.slice(-8).reduce((s, w) => s + w.tss, 0) / weeks.slice(-8).length : 0;

  const relLabel = (i: number) => {
    const offset = tssWeeks.length - 1 - i;
    return offset === 0 ? 'This week' : `W-${offset}`;
  };
  const selWeek = selectedWeek != null ? tssWeeks[selectedWeek] : null;
  const selInfo = selWeek ? interpretWeeklyTSS(selWeek.tss, avgTss) : null;

  // Staggered grow-in for the TSS bars.
  const barAnims = useRef<Animated.Value[]>([]).current;
  while (barAnims.length < tssWeeks.length) barAnims.push(new Animated.Value(0));
  useEffect(() => {
    if (!tssWeeks.length) return;
    Animated.stagger(
      50,
      tssWeeks.map((_, i) =>
        Animated.timing(barAnims[i], { toValue: 1, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: false })
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tssWeeks.length, metrics.loading]);

  const goldRecord = prs.records.find((r) => r.record_type === 'best_5min_power');
  const otherRecords = prs.records.filter((r) => r.record_type !== 'best_5min_power');

  // --- level controls ---
  const cycleLevel = () => {
    const next = LEVELS[(LEVELS.indexOf(viewLevel) + 1) % LEVELS.length];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewLevel(next);
    setLevel(next); // persists to AsyncStorage + Supabase
    track('level_change');
  };
  const expandToIntermediate = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewLevel('intermediate');
    track('show_more');
  };

  // Fitness/Fatigue/Form plain phrases + numbers.
  const fitnessCards = [
    { key: 'ctl' as const, title: 'Fitness', phrase: `${ctlInfo.category}, ${trendWord(ctlTrend)}`, value: Math.round(ctl) },
    { key: 'atl' as const, title: 'Fatigue', phrase: `${atlInfo.label}${atlInfo.isHigh ? ', ease off' : ', normal'}`, value: Math.round(atl) },
    { key: 'tsb' as const, title: 'Form', phrase: tsbInfo.label, value: Math.round(tsb) },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.slate400} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text variant="heading2" color={colors.textPrimary}>
            Progress
          </Text>
          <View style={styles.syncPill}>
            <View style={[styles.dot, { backgroundColor: synced ? palette.emerald400 : palette.amber400 }]} />
            <Text variant="caption" color={colors.textSecondary}>
              {synced ? 'Synced' : 'Sync needed'}
            </Text>
          </View>
        </View>

        {/* Level toggle (subtle) */}
        <Pressable style={styles.levelToggle} onPress={cycleLevel} hitSlop={8}>
          <Feather name="sliders" size={12} color={palette.slate400} />
          <Text variant="caption" color={palette.slate400}>
            {viewLevel === 'beginner' ? 'Beginner view' : viewLevel === 'intermediate' ? 'Standard view' : 'Advanced view'}
          </Text>
        </Pressable>

        {/* Low-priority nudge chip */}
        {low[0] ? (
          <View style={[styles.nudgeChip, { backgroundColor: colors.surfaceRaised }]}>
            <Emoji size={13}>{low[0].icon}</Emoji>
            <Text variant="caption" color={colors.textPrimary}>
              {low[0].message}
            </Text>
          </View>
        ) : null}

        {/* FTP card */}
        {ftp.loading ? (
          <SkeletonLoader height={120} borderRadius={radius.lg} />
        ) : (
          <Card variant="dark" padding={20}>
            <Text variant="label" color={palette.slate400}>
              YOUR ENGINE
            </Text>
            <View style={styles.ftpHeadRow}>
              <View style={styles.ftpValueRow}>
                <Text variant="stat" color="#FFFFFF">
                  {ftpWatts || '—'}
                </Text>
                <Text variant="caption" color={palette.slate400} style={styles.ftpUnit}>
                  watts
                </Text>
              </View>
              <View style={styles.ftpBadge}>
                <Emoji size={14}>🎖️</Emoji>
                <Badge label={ftpInfo.category} color={badgeColor} />
              </View>
            </View>
            {ftpInfo.changeLabel ? (
              <Text variant="caption" color={ftpDelta && ftpDelta > 0 ? palette.emerald400 : palette.slate200} style={styles.ftpChange}>
                {ftpInfo.changeLabel}
                {ftpDelta && ftpDelta > 0 ? ' — visible progress!' : ''}
              </Text>
            ) : null}

            {showNumbers ? (
              <View style={styles.ftpFooter}>
                <Text variant="statSm" color="rgba(255,255,255,0.7)">
                  {ftpInfo.wattsPerKg ? `${ftpInfo.wattsPerKg} W/kg` : '—'}
                </Text>
                <View style={styles.flex} />
                {ftpHist.length ? (
                  <Pressable onPress={() => setShowFtpChart((v) => !v)} hitSlop={8} style={styles.ftpHistoryBtn}>
                    <Text variant="caption" color={palette.indigo100}>
                      {showFtpChart ? 'Hide history' : 'History'}
                    </Text>
                    <Feather name={showFtpChart ? 'chevron-up' : 'chevron-down'} size={14} color={palette.indigo100} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable onPress={() => show('ftp', ftpWatts || undefined)} hitSlop={8} style={styles.ftpLink}>
                <Text variant="caption" color={palette.indigo100} style={styles.bold}>
                  What does FTP mean? →
                </Text>
              </Pressable>
            )}
          </Card>
        )}
        {showNumbers && showFtpChart && ftpHist.length ? (
          <Card variant="default">
            <SectionHeader title="FTP HISTORY" />
            <FTPChart history={ftpHist} />
          </Card>
        ) : null}

        {/* Fitness overview — plain language, numbers gated */}
        {metrics.loading ? (
          <SkeletonLoader height={120} borderRadius={radius.lg} />
        ) : (
          <View style={styles.fitnessList}>
            {fitnessCards.map((c) => (
              <Card key={c.key} variant="tinted" style={styles.fitnessCard}>
                <View style={styles.flex}>
                  <Text variant="label" color={palette.slate400}>
                    {c.title}
                  </Text>
                  <Text variant="body" color={colors.textPrimary} style={styles.fitnessPhrase}>
                    {c.phrase}
                  </Text>
                </View>
                {showNumbers ? (
                  <View style={styles.fitnessNumber}>
                    <Text variant="statSm" color={colors.textSecondary}>
                      {c.value}
                    </Text>
                    <MetricTooltip metric={c.key} value={c.value} />
                  </View>
                ) : null}
              </Card>
            ))}
            {!showNumbers ? (
              <Pressable style={styles.showNumbers} onPress={expandToIntermediate} hitSlop={6}>
                <Text variant="label" color={palette.indigo600}>
                  Show numbers
                </Text>
                <Feather name="chevron-down" size={16} color={palette.indigo600} />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Weekly chart */}
        <Card variant="default">
          <SectionHeader title="WEEKLY TRAINING" />
          {metrics.loading ? (
            <SkeletonLoader height={140} />
          ) : (
            <>
              <View style={styles.chart}>
                {tssWeeks.map((w, i) => {
                  const isCurrent = i === tssWeeks.length - 1;
                  const h = Math.max(4, (w.tss / maxTss) * 120);
                  return (
                    <Pressable
                      key={w.week_start}
                      style={styles.barCol}
                      onPress={() => setSelectedWeek(selectedWeek === i ? null : i)}
                    >
                      {showNumbers ? (
                        <Text variant="caption" color={colors.textSecondary} style={styles.barValue}>
                          {Math.round(w.tss)}
                        </Text>
                      ) : null}
                      <Animated.View
                        style={[
                          styles.bar,
                          {
                            height: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, h] }),
                            backgroundColor: isCurrent ? palette.slate800 : palette.slate200,
                          },
                        ]}
                      />
                      <Text variant="caption" color={palette.slate400} style={styles.barLabel}>
                        {relLabel(i)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selInfo ? (
                <Text variant="caption" color={colors.textPrimary} style={styles.chartCaption}>
                  {relLabel(selectedWeek as number)}: {selInfo.label}, {selInfo.vsAverage}
                </Text>
              ) : (
                <Text variant="caption" color={palette.slate400} style={styles.chartCaption}>
                  Tap a bar for details
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Personal records — always visible */}
        <View style={styles.section}>
          <SectionHeader title="PERSONAL RECORDS" />
          {prs.loading ? (
            <SkeletonLoader height={90} borderRadius={radius.md} />
          ) : prs.records.length === 0 ? (
            <Text variant="caption">No records yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prScroll}>
              {goldRecord ? (
                <View style={[styles.prCard, styles.goldCard]}>
                  <Text variant="statMd" color={palette.amber600}>
                    {goldRecord.value}
                    <Text variant="caption" color={palette.amber600}>{` ${goldRecord.unit === 'watts' ? 'W' : goldRecord.unit}`}</Text>
                  </Text>
                  <Text variant="caption">{RECORD_LABELS[goldRecord.record_type] ?? goldRecord.record_type}</Text>
                </View>
              ) : null}
              {otherRecords.map((r) => (
                <Card key={r.record_type} variant="default" style={styles.prCard}>
                  <Text variant="statMd" color={colors.textPrimary}>
                    {r.value}
                    <Text variant="caption" color={colors.textSecondary}>{` ${r.unit === 'watts' ? 'W' : r.unit}`}</Text>
                  </Text>
                  <Text variant="caption">{RECORD_LABELS[r.record_type] ?? r.record_type}</Text>
                </Card>
              ))}
            </ScrollView>
          )}
        </View>

        {/* AI coach */}
        <Card variant="raised">
          <View style={styles.coachHeader}>
            <Emoji style={styles.coachIcon}>🤖</Emoji>
            <View style={styles.flex}>
              <Text variant="label">AI COACH</Text>
            </View>
            {week.analysis ? (
              <AIAnalysisBadge isCached={!!week.analysis._cached} generatedAt={week.analysis._generated_at} onRefresh={week.regenerate} />
            ) : null}
          </View>
          <Text variant="body" color={colors.textPrimary} style={styles.coachText}>
            {week.analysis?.summary ?? 'Sync your rides to get coach analysis.'}
          </Text>
          {!recs.loading && recs.recommendations.length ? (
            <View style={styles.chipRow}>
              {recs.recommendations.map((r, i) => (
                <Pressable key={i} style={styles.chip} onPress={() => Alert.alert(r.action_cta, r.message)}>
                  <Text variant="caption" color={palette.indigo600} style={styles.bold}>
                    {r.action_cta}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.coachActionsRow}>
            <Button label="Ask coach" variant="ghost" size="sm" onPress={() => navigation.navigate('CoachChat')} />
            <Button label="Full analysis →" variant="ghost" size="sm" onPress={() => navigation.navigate('AIReport')} />
          </View>
        </Card>

        {/* Goals — coach tracks progress toward these */}
        <GoalsSection />

        {/* Advanced-only: W' card */}
        {showAdvanced ? (
          <Card variant="default">
            <View style={styles.cardHeadRow}>
              <SectionHeader title="ANAEROBIC CAPACITY (W′)" />
              <Pressable hitSlop={10} onPress={() => show('wprime', profile.profile?.w_prime_total ?? 20000)}>
                <Feather name="info" size={14} color={palette.slate400} />
              </Pressable>
            </View>
            <Text variant="stat" color={colors.textPrimary}>
              {((profile.profile?.w_prime_total ?? 20000) / 1000).toFixed(1)}
              <Text variant="statSm" color={colors.textSecondary}> kJ</Text>
            </Text>
            <Text variant="caption" color={colors.textSecondary} style={styles.wprimeHint}>
              Your battery for efforts above FTP.
            </Text>
          </Card>
        ) : null}

        {/* Advanced-only: Power curve */}
        {showAdvanced ? (
          <Card variant="default">
            <SectionHeader title="POWER CURVE" />
            <View style={styles.toggleRow}>
              {(['alltime', '90d', '30d'] as const).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.toggle, pdcRange === r && styles.toggleActive]}
                  onPress={() => {
                    setPdcRange(r);
                    track('power_curve');
                  }}
                >
                  <Text variant="caption" color={pdcRange === r ? '#FFFFFF' : colors.textSecondary} style={styles.bold}>
                    {r === 'alltime' ? 'All' : r === '90d' ? '90 days' : '30 days'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {pdc.loading ? (
              <SkeletonLoader height={200} />
            ) : (
              <PowerCurveChart
                width={chartWidth}
                points={pdcData.map((p) => ({ duration_sec: p.duration_sec, power_watts: p.power_watts }))}
                reference={pdcRange !== 'alltime' ? pdc.alltime.map((p) => ({ duration_sec: p.duration_sec, power_watts: p.power_watts })) : undefined}
                typeLabel={rider.profile && rider.profile.rider_type !== 'unknown' ? rider.profile.label : undefined}
              />
            )}
          </Card>
        ) : null}

        {/* Bottom CTAs */}
        <View style={styles.cta}>
          {ftpStale ? (
            <Button label="Start FTP test" variant="primary" size="lg" onPress={() => navigation.navigate('FTPTestWizard')} />
          ) : null}
          <Button label="View periodization →" variant="ghost" onPress={() => navigation.navigate('Periodization')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncPill: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 7, height: 7, borderRadius: radius.full },
  levelToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-end', marginTop: -spacing[2] },
  nudgeChip: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },

  ftpHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  ftpValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] },
  ftpUnit: { marginBottom: 2 },
  ftpBadge: { alignItems: 'flex-end', gap: spacing[1], flexDirection: 'row' },
  ftpChange: { marginTop: spacing[2], fontWeight: '600' },
  ftpFooter: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[4] },
  ftpHistoryBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  ftpLink: { marginTop: spacing[4] },

  fitnessList: { gap: spacing[2] },
  fitnessCard: { flexDirection: 'row', alignItems: 'center', padding: spacing[4] },
  fitnessPhrase: { fontWeight: '600', marginTop: 2 },
  fitnessNumber: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing[2] },
  showNumbers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], paddingVertical: spacing[2] },

  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingTop: spacing[4] },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1] },
  bar: { width: '55%', borderRadius: radius.xs },
  barValue: { fontWeight: '700', fontSize: 10 },
  barLabel: { fontSize: 10 },
  chartCaption: { marginTop: spacing[3] },

  section: { gap: spacing[3] },
  prScroll: { gap: spacing[3], paddingVertical: spacing[1] },
  prCard: { minWidth: 130, gap: spacing[1] },
  goldCard: { minWidth: 130, gap: spacing[1], backgroundColor: palette.amber50, borderLeftColor: palette.amber600, borderLeftWidth: 3, borderRadius: radius.md, padding: 16 },

  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  coachIcon: { fontSize: 20 },
  coachText: { lineHeight: 23 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  chip: { backgroundColor: palette.indigo50, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  coachActions: { alignItems: 'flex-end', marginTop: spacing[2] },
  coachActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[2] },

  cardHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wprimeHint: { marginTop: spacing[2] },

  toggleRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  toggle: { flex: 1, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: palette.slate200, alignItems: 'center' },
  toggleActive: { backgroundColor: palette.slate900, borderColor: palette.slate900 },

  cta: { marginTop: spacing[2], gap: spacing[2] },
});
