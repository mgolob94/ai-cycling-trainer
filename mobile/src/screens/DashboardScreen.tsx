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
import { Text, Card, Badge, StatCard, SectionHeader } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { AppStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type BadgeColor = 'emerald' | 'indigo' | 'amber' | 'rose';

function formStatus(tsb: number): { label: string; color: BadgeColor } {
  if (tsb >= 15) return { label: 'Fresh', color: 'emerald' };
  if (tsb >= 5) return { label: 'Optimal', color: 'indigo' };
  if (tsb >= -10) return { label: 'Tired', color: 'amber' };
  return { label: 'Overreached', color: 'rose' };
}

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

  const [bannerVisible, setBannerVisible] = useState(false);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);

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
  const status = formStatus(tsb);
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();

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

        {/* Hero — form today */}
        <Animated.View style={heroStyle}>
        <Card variant="dark" padding={20} style={styles.hero}>
          <View style={styles.heroTop}>
            <Text variant="label" color={palette.slate400}>
              FORM TODAY
            </Text>
            <Badge label={status.label} color={status.color} />
          </View>
          <Text variant="stat" color="#FFFFFF">
            {tsb > 0 ? `+${Math.round(tsb)}` : Math.round(tsb)}
          </Text>
          <Text variant="caption" color={palette.slate400}>
            Ready to train
          </Text>
          <View style={styles.heroStats}>
            {[
              { label: 'CTL', value: Math.round(ctl) },
              { label: 'ATL', value: Math.round(atl) },
              { label: 'TSB', value: Math.round(tsb) },
            ].map((s) => (
              <View key={s.label} style={styles.heroStat}>
                <Text variant="statSm" color="#FFFFFF">
                  {s.value}
                </Text>
                <Text variant="label" color={palette.slate400}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
        </Animated.View>

        {/* This week */}
        <View style={styles.section}>
          <SectionHeader
            title="THIS WEEK"
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
  heroStats: { flexDirection: 'row', marginTop: spacing[4], borderTopWidth: 1, borderTopColor: palette.slate800, paddingTop: spacing[3] },
  heroStat: { flex: 1, gap: 2 },

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
