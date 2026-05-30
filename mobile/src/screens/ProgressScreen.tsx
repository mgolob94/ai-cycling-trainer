import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Dimensions, Pressable, Alert, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useProfile } from '../hooks/useProfile';
import { useWeeklyMetrics } from '../hooks/useWeeklyMetrics';
import { useFtp } from '../hooks/useFtp';
import { useRiderProfile } from '../hooks/useRiderProfile';
import { usePowerCurve } from '../hooks/usePowerCurve';
import { useWeekAnalysis } from '../hooks/useWeekAnalysis';
import { useRecommendations } from '../hooks/useRecommendations';
import { usePersonalRecords, type PersonalRecord } from '../hooks/usePersonalRecords';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useNudges } from '../hooks/useNudges';
import PowerCurveChart from '../components/PowerCurveChart';
import FTPChart from '../components/FTPChart';
import AIAnalysisBadge from '../components/AIAnalysisBadge';
import { Text, Card, Badge, StatCard, SectionHeader, Button, SkeletonLoader } from '../components/ui';
import MetricTooltip from '../components/metrics/MetricTooltip';
import { scheduleWeeklySummary } from '../services/notifications';
import { palette, spacing, radius } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { AppStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type BadgeColor = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

function riderCategory(wkg: number | null): { label: string; color: BadgeColor } {
  if (wkg == null) return { label: '—', color: 'default' };
  if (wkg < 2.0) return { label: 'Recreational', color: 'default' };
  if (wkg < 3.0) return { label: 'Fitness', color: 'sky' };
  if (wkg < 4.0) return { label: 'Amateur', color: 'indigo' };
  if (wkg < 5.0) return { label: 'Advanced', color: 'emerald' };
  return { label: 'Elite', color: 'amber' };
}

const RECORD_LABELS: Record<string, string> = {
  best_5min_power: '5 min power',
  best_20min_power: '20 min power',
  best_60min_power: '1 hr power',
  longest_ride_km: 'Longest ride',
  most_elevation_m: 'Most elevation',
};

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

  const [pdcRange, setPdcRange] = useState<'alltime' | '90d' | '30d'>('alltime');
  const [showFtpChart, setShowFtpChart] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

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
  const wkg = ftp.ftp?.watts_per_kg ?? null;
  const cat = riderCategory(wkg);

  // FTP delta vs the previous recorded test.
  const ftpHist = ftp.history;
  const ftpDelta =
    ftpHist.length >= 2 && ftp.ftp ? ftp.ftp.ftp_watts - ftpHist[ftpHist.length - 2].ftp_watts : null;

  const ftpStale =
    !ftp.ftp?.test_date ||
    Date.now() - new Date(`${ftp.ftp.test_date}T00:00:00`).getTime() > 42 * 24 * 3600 * 1000;

  const synced = sync.connected && !sync.syncError && !sync.newActivitiesAvailable;
  const tssWeeks = weeks.slice(-8);
  const maxTss = Math.max(1, ...tssWeeks.map((w) => w.tss));

  // Staggered grow-in for the TSS bars.
  const barAnims = useRef<Animated.Value[]>([]).current;
  while (barAnims.length < tssWeeks.length) barAnims.push(new Animated.Value(0));
  useEffect(() => {
    if (!tssWeeks.length) return;
    Animated.stagger(
      50,
      tssWeeks.map((_, i) =>
        Animated.timing(barAnims[i], {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false,
        })
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tssWeeks.length, metrics.loading]);

  const goldRecord = prs.records.find((r) => r.record_type === 'best_5min_power');
  const otherRecords = prs.records.filter((r) => r.record_type !== 'best_5min_power');

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

        {/* Low-priority nudge chip */}
        {low[0] ? (
          <View style={[styles.nudgeChip, { backgroundColor: colors.surfaceRaised }]}>
            <Text variant="caption" color={colors.textPrimary}>
              {low[0].icon} {low[0].message}
            </Text>
          </View>
        ) : null}

        {/* FTP hero */}
        {ftp.loading ? (
          <SkeletonLoader height={120} borderRadius={radius.lg} />
        ) : (
          <Card variant="dark" padding={20}>
            <Pressable onPress={() => setShowFtpChart((v) => !v)} style={styles.ftpHeroRow}>
              <View>
                <View style={styles.ftpLabelRow}>
                  <Text variant="label" color={palette.slate400}>
                    FTP
                  </Text>
                  <MetricTooltip metric="ftp" value={ftp.ftp?.ftp_watts ?? undefined} />
                </View>
                <View style={styles.ftpValueRow}>
                  <Text variant="stat" color="#FFFFFF">
                    {ftp.ftp?.ftp_watts ?? '—'}
                  </Text>
                  <Text variant="caption" color={palette.slate400} style={styles.ftpUnit}>
                    watts
                  </Text>
                </View>
              </View>
              <View style={styles.ftpRight}>
                <Text variant="statMd" color="#FFFFFF">
                  {wkg != null ? wkg.toFixed(2) : '—'}
                </Text>
                <Text variant="label" color={palette.slate400}>
                  W/kg
                </Text>
                <View style={styles.catBadge}>
                  <Badge label={cat.label} color={cat.color} />
                </View>
              </View>
            </Pressable>
            {ftpDelta != null && ftpDelta !== 0 ? (
              <Text variant="caption" color={ftpDelta > 0 ? palette.emerald400 : palette.rose400} style={styles.ftpChip}>
                {ftpDelta > 0 ? `+${ftpDelta}W since last test ↑` : `${ftpDelta}W since last test ↓`}
              </Text>
            ) : null}
          </Card>
        )}
        {showFtpChart && ftpHist.length ? (
          <Card variant="default">
            <SectionHeader title="FTP HISTORY" />
            <FTPChart history={ftpHist} />
          </Card>
        ) : null}

        {/* Fitness triad */}
        {metrics.loading ? (
          <SkeletonLoader height={90} borderRadius={radius.lg} />
        ) : (
          <View style={styles.triad}>
            <Card variant="tinted" style={styles.triadCard}>
              <StatCard size="md" value={Math.round(current?.ctl ?? 0)} label="Fitness" tooltipMetric="ctl" />
            </Card>
            <Card variant="tinted" style={styles.triadCard}>
              <StatCard size="md" value={Math.round(current?.atl ?? 0)} label="Fatigue" tooltipMetric="atl" />
            </Card>
            <Card variant="tinted" style={styles.triadCard}>
              <View style={styles.tsbWrap}>
                <Text variant="statMd" color={(current?.tsb ?? 0) >= 0 ? palette.emerald600 : palette.rose600}>
                  {Math.round(current?.tsb ?? 0)}
                </Text>
                <View style={styles.tsbLabelRow}>
                  <Text variant="label">Form</Text>
                  <MetricTooltip metric="tsb" value={current?.tsb ?? 0} />
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Weekly TSS chart */}
        <Card variant="default">
          <SectionHeader title="WEEKLY TSS" />
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
                      {selectedWeek === i ? (
                        <Text variant="caption" color={colors.textPrimary} style={styles.barValue}>
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
                        {w.week_start.slice(5)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Card>

        {/* Personal records */}
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
                    <Text variant="caption" color={palette.amber600}>
                      {' '}
                      {goldRecord.unit === 'watts' ? 'W' : goldRecord.unit}
                    </Text>
                  </Text>
                  <Text variant="caption">{RECORD_LABELS[goldRecord.record_type] ?? goldRecord.record_type}</Text>
                </View>
              ) : null}
              {otherRecords.map((r) => (
                <Card key={r.record_type} variant="default" style={styles.prCard}>
                  <Text variant="statMd" color={colors.textPrimary}>
                    {r.value}
                    <Text variant="caption" color={colors.textSecondary}>
                      {' '}
                      {r.unit === 'watts' ? 'W' : r.unit}
                    </Text>
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
            <Text style={styles.coachIcon}>🤖</Text>
            <View style={styles.flex}>
              <Text variant="label">AI COACH</Text>
            </View>
            {week.analysis ? (
              <AIAnalysisBadge
                isCached={!!week.analysis._cached}
                generatedAt={week.analysis._generated_at}
                onRefresh={week.regenerate}
              />
            ) : null}
          </View>
          <Text variant="body" color={colors.textPrimary} style={styles.coachText}>
            {week.analysis?.summary ?? 'Sync your rides to get coach analysis.'}
          </Text>
          {week.analysis?.warning ? (
            <Text variant="caption" color={palette.rose600} style={styles.coachWarn}>
              ⚠︎ {week.analysis.warning}
            </Text>
          ) : null}
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
          <View style={styles.coachActions}>
            <Button label="Full analysis →" variant="ghost" size="sm" onPress={() => navigation.navigate('AIReport')} />
          </View>
        </Card>

        {/* Power curve (retained analytics) */}
        <Card variant="default">
          <SectionHeader title="POWER CURVE" />
          <View style={styles.toggleRow}>
            {(['alltime', '90d', '30d'] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.toggle, pdcRange === r && styles.toggleActive]}
                onPress={() => setPdcRange(r)}
              >
                <Text
                  variant="caption"
                  color={pdcRange === r ? '#FFFFFF' : colors.textSecondary}
                  style={styles.bold}
                >
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
              reference={
                pdcRange !== 'alltime'
                  ? pdc.alltime.map((p) => ({ duration_sec: p.duration_sec, power_watts: p.power_watts }))
                  : undefined
              }
              typeLabel={rider.profile && rider.profile.rider_type !== 'unknown' ? rider.profile.label : undefined}
            />
          )}
        </Card>

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
  nudgeChip: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },

  ftpHeroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  ftpValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] },
  ftpUnit: { marginBottom: 2 },
  ftpRight: { alignItems: 'flex-end', gap: 2 },
  catBadge: { marginTop: spacing[2] },
  ftpChip: { marginTop: spacing[3], fontWeight: '600' },

  triad: { flexDirection: 'row', gap: spacing[2] },
  triadCard: { flex: 1, padding: spacing[4] },
  tsbWrap: { gap: spacing[1] },
  tsbLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  ftpLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },

  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingTop: spacing[4] },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1] },
  bar: { width: '60%', borderRadius: radius.xs },
  barValue: { fontWeight: '700' },
  barLabel: { fontSize: 10 },

  section: { gap: spacing[3] },
  prScroll: { gap: spacing[3], paddingVertical: spacing[1] },
  prCard: { minWidth: 130, gap: spacing[1] },
  goldCard: {
    minWidth: 130,
    gap: spacing[1],
    backgroundColor: palette.amber50,
    borderLeftColor: palette.amber600,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: 16,
  },

  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  coachIcon: { fontSize: 20 },
  coachText: { lineHeight: 23 },
  coachWarn: { marginTop: spacing[2] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  chip: { backgroundColor: palette.indigo50, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  coachActions: { alignItems: 'flex-end', marginTop: spacing[2] },

  toggleRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  toggle: { flex: 1, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: palette.slate200, alignItems: 'center' },
  toggleActive: { backgroundColor: palette.slate900, borderColor: palette.slate900 },

  cta: { marginTop: spacing[2], gap: spacing[2] },
});
