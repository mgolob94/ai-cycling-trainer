import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTrainingPlan, type Ride, type Workout, type PhaseResult } from '../hooks/useTrainingPlan';
import { api, type ApiResponse } from '../services/api';
import EventSetup from '../components/plan/EventSetup';
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

import { Text, Card, Badge, StatCard, SectionHeader, QuickToggle, Emoji } from '../components/ui';
import CoachFab from '../components/coach/CoachFab';
import WeekSummaryCard from '../components/dashboard/WeekSummaryCard';
import NudgeItem from '../components/dashboard/NudgeItem';
import { useNudges } from '../hooks/useNudges';
import { useKnowledgeLevel } from '../context/KnowledgeLevelContext';
import TrainingScaleBar, { type ScaleZone } from '../components/metrics/TrainingScaleBar';
import MetricTooltip from '../components/metrics/MetricTooltip';
import { interpretTSB, interpretATL } from '../services/metricsInterpreter';
import { palette, spacing, radius, zoneColors } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { AppStackParamList } from '../navigation/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// TSB spectrum zones for the hero scale bar.
const TSB_ZONES: ScaleZone[] = [
  { from: -40, to: -20, label: 'Overreached', color: palette.rose400 },
  { from: -20, to: -5, label: 'Tired', color: palette.amber400 },
  { from: -5, to: 12, label: 'Optimal', color: palette.emerald400 },
  { from: 12, to: 25, label: 'Fresh', color: palette.emerald400 },
  { from: 25, to: 40, label: 'Very fresh', color: palette.emerald600 },
];

// Hero expand state is remembered for the session only (module scope → resets
// on a cold app start), so beginners re-collapse next launch.
let heroExpandedSession = false;

type TrendVisual = { trendIcon: 'trending-up' | 'trending-down' | 'minus'; trendColor: string };
function heroTrend(delta: number, goodUp: boolean): TrendVisual {
  if (delta > 1) return { trendIcon: 'trending-up', trendColor: goodUp ? palette.emerald400 : palette.rose400 };
  if (delta < -1) return { trendIcon: 'trending-down', trendColor: goodUp ? palette.rose400 : palette.emerald400 };
  return { trendIcon: 'minus', trendColor: palette.slate400 };
}

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
      return zoneColors.z2;
    case 'moderate':
      return zoneColors.z3;
    case 'hard':
      return zoneColors.z5;
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

function WorkoutRow({ workout, isToday, onPress }: { workout: Workout; isToday: boolean; onPress?: () => void }) {
  const { colors } = useThemeColors();
  const color = intensityColor(workout.intensity);
  const isRest = workout.type?.toLowerCase() === 'rest' || workout.duration_min === 0;
  return (
    <Card variant={isToday ? 'raised' : 'tinted'} padding={0} style={styles.workoutCard} onPress={onPress}>
      <View style={[styles.workoutBar, { backgroundColor: isToday ? colors.primary : color, width: isToday ? 4 : 3 }]} />
      <View style={styles.workoutBody}>
        <View style={styles.workoutHead}>
          <View style={styles.workoutText}>
            <View style={styles.workoutDayRow}>
              <Text variant="body" style={styles.workoutName}>
                {workout.day}
              </Text>
              {isToday ? <Badge label="Today" color="indigo" /> : null}
            </View>
            <Text variant="caption" color={palette.slate400}>
              {workout.type}
              {isRest ? '' : ` · ${workout.duration_min} min`}
            </Text>
          </View>
          <Badge label={workout.intensity} color={intensityBadgeColor(workout.intensity)} />
        </View>
        {workout.description ? (
          <Text variant="caption" style={styles.workoutDesc}>
            {workout.description}
          </Text>
        ) : null}
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
  const { track, config } = useKnowledgeLevel();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);
  const [noEvent, setNoEvent] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  // Whether the user has a target event set (drives the "add goal" banner).
  const loadEventState = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<PhaseResult>>('/plans/phase');
      setNoEvent(data.data != null && data.data.weeks_to_event == null);
    } catch {
      setNoEvent(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadEventState();
    }, [loadEventState])
  );
  // Advanced users default to the intermediate (expanded) state; beginners stay
  // collapsed unless they expanded earlier this session.
  const [showDetails, setShowDetails] = useState(config.defaultExpanded || heroExpandedSession);

  const expandHero = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowDetails(true);
    heroExpandedSession = true;
    track('show_more'); // level 1 → 2 (auto-upgrade trigger)
  };
  const collapseHero = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowDetails(false);
    heroExpandedSession = false;
  };

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
  const atlInfo = interpretATL(atl, atlTrend, ctl);
  const tsbTrend = priorWeek ? tsb - priorWeek.tsb : 0;

  // Two plain-language trend chips (no numbers).
  const fitnessChip =
    ctlTrend > 1
      ? { icon: 'trending-up' as const, color: palette.emerald400, label: 'Fitness rising' }
      : ctlTrend < -1
        ? { icon: 'trending-down' as const, color: palette.rose400, label: 'Fitness dropping' }
        : { icon: 'minus' as const, color: palette.slate400, label: 'Fitness steady' };
  const fatigueChip = atlInfo.isHigh
    ? { icon: 'alert-triangle' as const, color: palette.amber400, label: 'Fatigue high' }
    : { icon: 'check' as const, color: palette.emerald400, label: 'Fatigue OK' };
  const heroChips = [fitnessChip, fatigueChip];

  // Hidden numbers (revealed at the intermediate level), with trend arrows.
  const heroMetrics = [
    { key: 'ctl' as const, label: 'CTL', value: Math.round(ctl), ...heroTrend(ctlTrend, true) },
    { key: 'atl' as const, label: 'ATL', value: Math.round(atl), ...heroTrend(atlTrend, false) },
    { key: 'tsb' as const, label: 'TSB', value: Math.round(tsb), ...heroTrend(tsbTrend, true) },
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
            <QuickToggle />
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
              <Text variant="caption" color={colors.accent} style={styles.bold}>
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
              <Text variant="caption" color={colors.accent} style={styles.bold}>
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
            {/* Row 4 — two plain-language trend chips (no numbers) */}
            <View style={styles.chipRow}>
              {heroChips.map((c) => (
                <View key={c.label} style={styles.trendChip}>
                  <Feather name={c.icon} size={12} color={c.color} />
                  <Text variant="caption" color={palette.slate200}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </View>
            {/* Row 5 — numbers (intermediate state), revealed on expand */}
            {showDetails ? (
              <>
                <View style={styles.heroDivider} />
                <View style={styles.heroStats}>
                  {heroMetrics.map((m) => (
                    <View key={m.key} style={styles.heroStat}>
                      <View style={styles.heroValueRow}>
                        <Text variant="statSm" color="rgba(255,255,255,0.7)">
                          {m.value}
                        </Text>
                        <Feather name={m.trendIcon} size={12} color={m.trendColor} />
                      </View>
                      <View style={styles.heroStatLabel}>
                        <Text variant="label" color={palette.slate400}>
                          {m.label}
                        </Text>
                        <MetricTooltip metric={m.key} value={m.value} />
                      </View>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.detailsToggle} hitSlop={6} onPress={collapseHero}>
                  <Text variant="label" color={palette.slate400}>
                    Hide
                  </Text>
                  <Feather name="chevron-up" size={16} color={palette.slate400} />
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.detailsToggle} hitSlop={6} onPress={expandHero}>
                <Text variant="label" color={palette.slate400}>
                  Details
                </Text>
                <Feather name="chevron-down" size={16} color={palette.slate400} />
              </Pressable>
            )}
          </Card>
        </Animated.View>

        {/* Plain-language week summary */}
        {latest ? (
          <WeekSummaryCard week={latest} prevWeek={priorWeek} avgTss={avgTss} />
        ) : null}

        {/* Add-goal CTA — prominent when no target event is set */}
        {noEvent ? (
          <Pressable onPress={() => setEventOpen(true)}>
            <Card variant="tinted" style={styles.goalCta}>
              <View style={[styles.goalIcon, { backgroundColor: colors.primary }]}>
                <Emoji size={18}>🏁</Emoji>
              </View>
              <View style={styles.flex}>
                <Text variant="body" color={colors.textPrimary} style={styles.bold}>
                  Add your goal event
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Training for a race or Gran Fondo? Set the date and the coach plans backwards from it.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.primary} />
            </Card>
          </Pressable>
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
                <WorkoutRow
                  key={`${w.day}-${i}`}
                  workout={w}
                  isToday={w.day === todayWeekday}
                  onPress={() => navigation.navigate('TrainingPlan')}
                />
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
              <Text variant="caption" color={colors.accent} style={styles.bold}>
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
              <Text variant="caption" color={colors.accent} style={styles.bold}>
                Sync Strava
              </Text>
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
      <CoachFab />
      <EventSetup visible={eventOpen} onClose={() => setEventOpen(false)} onSaved={() => { loadEventState(); refresh(); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[16], gap: spacing[5] },
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
  goalCta: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  goalIcon: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
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
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[3] },
  heroDivider: { height: 1, backgroundColor: palette.slate800, marginTop: spacing[4] },
  heroStats: { flexDirection: 'row', marginTop: spacing[3] },
  heroStat: { flex: 1, gap: 2 },
  heroValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  heroStatLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[4] },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
  },

  section: { gap: spacing[3] },
  workoutList: { gap: spacing[2] },
  workoutCard: { flexDirection: 'row', overflow: 'hidden' },
  workoutBar: {},
  workoutBody: { flex: 1, padding: spacing[4], gap: spacing[2] },
  workoutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  workoutText: { gap: 2, flex: 1 },
  workoutDayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  workoutName: { fontWeight: '600' },
  workoutDesc: { lineHeight: 18 },

  statScroll: { gap: spacing[3], paddingRight: spacing[5] },
  statBox: { minWidth: 120 },
});
