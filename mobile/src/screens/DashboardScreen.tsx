import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTrainingPlan, type Ride, type Workout } from '../hooks/useTrainingPlan';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useWeeklyMetrics } from '../hooks/useWeeklyMetrics';
import SyncIndicator from '../components/SyncIndicator';
import {
  shouldShowStravaPrompt,
  dismissStravaPrompt,
  clearStravaSkipped,
} from '../services/stravaOnboarding';
import { hasSeenMetricsIntro } from '../services/metricsIntro';
import { Feather } from '@expo/vector-icons';

import { Text, Card, Badge, StatCard, SectionHeader } from '../components/ui';
import WeekSummaryCard from '../components/dashboard/WeekSummaryCard';
import NudgeItem from '../components/dashboard/NudgeItem';
import { useNudges } from '../hooks/useNudges';
import TrainingScaleBar, { type ScaleZone } from '../components/metrics/TrainingScaleBar';
import MetricTooltip from '../components/metrics/MetricTooltip';
import {
  interpretTSB,
  interpretCTL,
  interpretATL,
  interpretWeeklyTSS,
} from '../services/metricsInterpreter';
import { palette, spacing, radius } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { AppStackParamList } from '../navigation/types';

// TSB spectrum zones for the hero scale bar.
const TSB_ZONES: ScaleZone[] = [
  { from: -40, to: -20, label: 'Overreached', color: palette.rose400 },
  { from: -20, to: -5, label: 'Tired', color: palette.amber400 },
  { from: -5, to: 12, label: 'Optimal', color: palette.indigo400 },
  { from: 12, to: 25, label: 'Fresh', color: palette.emerald400 },
  { from: 25, to: 40, label: 'Very fresh', color: palette.emerald600 },
];

type Nav = NativeStackNavigationProp<AppStackParamList>;

type BadgeColor = 'emerald' | 'indigo' | 'amber' | 'rose';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

// Workout intensity → representative zone color.
function intensityColor(intensity: string): string {
  switch (intensity?.toLowerCase()) {
    case 'easy':
      return '#60A5FA'; // Z2
    case 'moderate':
      return '#34D399'; // Z3
    case 'hard':
      return '#F97316'; // Z5
    default:
      return palette.slate200;
  }
}

function intensityBadgeColor(intensity: string): BadgeColor | 'sky' {
  switch (intensity?.toLowerCase()) {
    case 'easy':
      return 'sky';
    case 'moderate':
      return 'emerald';
    case 'hard':
      return 'amber';
    default:
      return 'indigo';
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

function WorkoutRow({ workout, isToday }: { workout: Workout; isToday: boolean }) {
  const color = intensityColor(workout.intensity);
  return (
    <Card variant={isToday ? 'raised' : 'tinted'} padding={0} style={styles.workoutCard}>
      <View style={[styles.workoutBar, { backgroundColor: isToday ? palette.slate900 : color, width: isToday ? 4 : 3 }]} />
      <View style={styles.workoutBody}>
        <View style={styles.workoutText}>
          <Text variant="body" style={styles.workoutName}>
            {workout.day}
          </Text>
          <Text variant="caption">
            {workout.type} · {workout.duration_min} min
          </Text>
        </View>
        <Badge label={workout.intensity} color={intensityBadgeColor(workout.intensity)} />
      </View>
    </Card>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useThemeColors();
  const { name, lastRide, plan, loading, error, refresh } = useTrainingPlan();
  const { weeks } = useWeeklyMetrics();
  const {
    connected,
    isSyncing,
    isInitialSyncing,
    progressPercent,
    lastSyncAt,
    newActivitiesAvailable,
    syncError,
    acknowledge,
  } = useSyncStatus();

  const { high, medium, dismiss } = useNudges();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Hero entrance: slide up + fade in, 100ms after mount.
  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 100);
    return () => clearTimeout(id);
  }, [heroAnim]);
  const heroStyle = {
    opacity: heroAnim,
    transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (connected) {
          await clearStravaSkipped();
          if (active) setShowSkipPrompt(false);
          return;
        }
        const show = await shouldShowStravaPrompt();
        if (active) setShowSkipPrompt(show);
      })();
      return () => {
        active = false;
      };
    }, [connected])
  );

  useEffect(() => {
    if (!newActivitiesAvailable) {
      setBannerVisible(false);
      return undefined;
    }
    setBannerVisible(true);
    const id = setTimeout(() => setBannerVisible(false), 10_000);
    return () => clearTimeout(id);
  }, [newActivitiesAvailable]);

  // One-time metrics education, after the first sync has produced metrics.
  const introChecked = useRef(false);
  useEffect(() => {
    if (introChecked.current) return;
    if (!connected || weeks.length === 0) return;
    introChecked.current = true;
    hasSeenMetricsIntro().then((seen) => {
      if (!seen) navigation.navigate('MetricsIntro');
    });
  }, [connected, weeks.length, navigation]);

  const handleBannerRefresh = useCallback(() => {
    setBannerVisible(false);
    acknowledge();
    refresh();
  }, [acknowledge, refresh]);

  const handleDismissSkip = useCallback(() => {
    setShowSkipPrompt(false);
    dismissStravaPrompt();
  }, []);

  const workouts = plan?.plan_json?.workouts ?? [];
  const latest = weeks.length ? weeks[weeks.length - 1] : null;
  const tsb = latest?.tsb ?? 0;
  const ctl = latest?.ctl ?? 0;
  const atl = latest?.atl ?? 0;
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();

  // Plain-language interpretations + trends for the hero.
  const prior4 = weeks.length >= 5 ? weeks[weeks.length - 5] : null;
  const priorWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  const ctlTrend = prior4 ? ctl - prior4.ctl : 0;
  const atlTrend = priorWeek ? atl - priorWeek.atl : 0;
  const recent4 = weeks.slice(-4);
  const avgTss = recent4.length ? recent4.reduce((s, w) => s + w.tss, 0) / recent4.length : 0;
  const tsbInfo = interpretTSB(tsb);
  const ctlInfo = interpretCTL(ctl, ctlTrend);
  const atlInfo = interpretATL(atl, atlTrend, ctl);
  const tssInfo = interpretWeeklyTSS(latest?.tss ?? 0, avgTss);

  const trendChips = [
    `Fitness ${ctlTrend >= 0 ? '↑' : '↓'} ${ctlTrend > 0 ? '+' : ''}${Math.round(ctlTrend)} this month`,
    `Fatigue ${atlInfo.isHigh ? '↑ high' : atlTrend <= 0 ? '↓ good' : 'steady'}`,
    `TSS this week: ${tssInfo.vsAverage}`,
  ];

  const staleSync =
    connected && !isSyncing && (!lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > 24 * 3600 * 1000);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.slate400} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text variant="caption">{greeting()}</Text>
            <Text variant="heading2" color={colors.textPrimary}>
              {name || '…'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <SyncIndicator
              isSyncing={isSyncing}
              newActivitiesAvailable={newActivitiesAvailable}
              syncError={!!syncError}
              onPress={() => navigation.navigate('StravaConnect')}
            />
            <Pressable style={styles.avatar} onPress={() => navigation.navigate('Profile')} hitSlop={8}>
              <Text variant="label" color="#FFFFFF" style={styles.avatarText}>
                {initials}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Banners (one at a time, by precedence) */}
        {isInitialSyncing ? (
          <Card variant="tinted" style={styles.banner}>
            <Text variant="caption" color={colors.textPrimary}>
              Importing activities ({Math.round(progressPercent)}%)…
            </Text>
          </Card>
        ) : bannerVisible ? (
          <Pressable onPress={handleBannerRefresh}>
            <Card variant="tinted" style={styles.bannerRow}>
              <Text variant="caption" color={colors.textPrimary}>
                New activity synced
              </Text>
              <Text variant="caption" color={palette.indigo600} style={styles.bold}>
                Refresh
              </Text>
            </Card>
          </Pressable>
        ) : showSkipPrompt ? (
          <Card variant="tinted" style={styles.bannerRow}>
            <Text variant="caption" color={colors.textPrimary} style={styles.flex}>
              Connect Strava for more accurate training
            </Text>
            <Pressable onPress={() => navigation.navigate('StravaConnect')} hitSlop={8}>
              <Text variant="caption" color={palette.indigo600} style={styles.bold}>
                Connect
              </Text>
            </Pressable>
            <Pressable onPress={handleDismissSkip} hitSlop={10}>
              <Text variant="caption" color={palette.slate400} style={styles.dismiss}>
                ✕
              </Text>
            </Pressable>
          </Card>
        ) : null}

        {error ? (
          <Text variant="caption" color={palette.rose600}>
            {error}
          </Text>
        ) : null}

        {/* High-priority nudge banner */}
        {high[0] ? (
          <NudgeItem
            nudge={high[0]}
            onAction={(screen) => navigation.navigate(screen as never)}
            onDismiss={dismiss}
          />
        ) : null}

        {/* Hero — form today (plain language) */}
        <Animated.View style={heroStyle}>
          <Card variant="dark" padding={20} style={styles.hero} onPress={() => navigation.navigate('Progress')}>
            {/* Row 1 — primary status */}
            <View style={styles.heroTop}>
              <Text variant="label" color={palette.slate400}>
                FORM TODAY
              </Text>
              <Badge label={tsbInfo.status === 'optimal' ? 'Optimal' : tsbInfo.label.split(' ')[0]} color={tsbInfo.color} />
            </View>
            <Text variant="heading2" color="#FFFFFF" style={styles.heroStatus}>
              {tsbInfo.label}
            </Text>
            {/* Row 2 — today's advice */}
            <Text variant="caption" color={palette.slate200} style={styles.heroAdvice}>
              {tsbInfo.todayAdvice}
            </Text>
            {/* Row 3 — scale bar */}
            <View style={styles.heroScale}>
              <TrainingScaleBar onDark value={tsb} min={-40} max={40} zones={TSB_ZONES} />
            </View>
            {/* Row 4 — secondary numbers (collapsible) */}
            <Pressable
              style={styles.detailsToggle}
              hitSlop={6}
              onPress={() => setShowDetails((v) => !v)}
            >
              <Text variant="label" color={palette.slate400}>
                Details
              </Text>
              <Feather name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={palette.slate400} />
            </Pressable>
            {showDetails ? (
              <View style={styles.heroStats}>
                {(
                  [
                    { key: 'ctl', label: 'CTL', value: Math.round(ctl) },
                    { key: 'atl', label: 'ATL', value: Math.round(atl) },
                    { key: 'tsb', label: 'TSB', value: Math.round(tsb) },
                  ] as const
                ).map((s) => (
                  <View key={s.label} style={styles.heroStat}>
                    <Text variant="statSm" color="#FFFFFF">
                      {s.value}
                    </Text>
                    <View style={styles.heroStatLabel}>
                      <Text variant="label" color={palette.slate400}>
                        {s.label}
                      </Text>
                      <MetricTooltip metric={s.key} value={s.value} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {/* Row 5 — trend chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {trendChips.map((c) => (
                <View key={c} style={styles.trendChip}>
                  <Text variant="caption" color={palette.slate200}>
                    {c}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Card>
        </Animated.View>

        {/* Plain-language week summary */}
        {latest ? (
          <WeekSummaryCard week={latest} prevWeek={priorWeek} avgTss={avgTss} />
        ) : null}

        {/* This week's plan */}
        <View style={styles.section}>
          <SectionHeader
            title="THIS WEEK'S PLAN"
            action={{ label: 'All workouts →', onPress: () => navigation.navigate('TrainingPlan') }}
          />
          {workouts.length ? (
            <View style={styles.workoutList}>
              {workouts.map((w, i) => (
                <WorkoutRow key={`${w.day}-${i}`} workout={w} isToday={w.day === todayWeekday} />
              ))}
            </View>
          ) : (
            <Text variant="caption">No plan yet — generate one from your recent rides.</Text>
          )}
        </View>

        {/* Medium-priority nudge */}
        {medium[0] ? (
          <NudgeItem nudge={medium[0]} onAction={(screen) => navigation.navigate(screen as never)} />
        ) : null}

        {/* Last ride */}
        {lastRide ? (
          <View style={styles.section}>
            <SectionHeader title="LAST RIDE" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statScroll}>
              <Card variant="default" style={styles.statBox}>
                <StatCard
                  size="md"
                  value={lastRide.distance_km != null ? lastRide.distance_km.toFixed(1) : '—'}
                  unit="km"
                  label="Distance"
                />
              </Card>
              <Card variant="default" style={styles.statBox}>
                <StatCard
                  size="md"
                  value={lastRide.avg_power_w != null ? Math.round(lastRide.avg_power_w) : '—'}
                  unit="W"
                  label="Power"
                />
              </Card>
              <Card variant="default" style={styles.statBox}>
                <StatCard size="md" value={formatDuration(lastRide.duration_sec)} label="Duration" />
              </Card>
            </ScrollView>
            <Pressable
              onPress={() => navigation.navigate('RideDetail', { stravaId: (lastRide as Ride).strava_id })}
              hitSlop={6}
            >
              <Text variant="caption" color={palette.indigo600} style={styles.bold}>
                View analysis →
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Stale-sync nudge */}
        {staleSync ? (
          <Pressable onPress={() => navigation.navigate('StravaConnect')}>
            <Card variant="tinted" style={styles.bannerRow}>
              <Text variant="caption">Last sync over 24h ago</Text>
              <Text variant="caption" color={palette.indigo600} style={styles.bold}>
                Sync Strava
              </Text>
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[5] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: palette.slate800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { letterSpacing: 0 },

  banner: { paddingVertical: spacing[3] },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  dismiss: { fontWeight: '700' },

  hero: { gap: spacing[1] },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  heroStatus: { fontSize: 26, fontWeight: '600' },
  heroAdvice: { lineHeight: 20, marginTop: spacing[1] },
  heroScale: { marginTop: spacing[4] },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[3] },
  heroStats: { flexDirection: 'row', marginTop: spacing[3], borderTopWidth: 1, borderTopColor: palette.slate800, paddingTop: spacing[3] },
  heroStat: { flex: 1, gap: 2 },
  heroStatLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  chipScroll: { gap: spacing[2], marginTop: spacing[4], paddingRight: spacing[2] },
  trendChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
  },

  section: { gap: spacing[3] },
  workoutList: { gap: spacing[2] },
  workoutCard: { flexDirection: 'row', overflow: 'hidden' },
  workoutBar: {},
  workoutBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  workoutText: { gap: 2, flex: 1 },
  workoutName: { fontWeight: '600' },

  statScroll: { gap: spacing[3], paddingRight: spacing[5] },
  statBox: { minWidth: 120 },
});
