import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTrainingPlan, type Ride, type Workout } from '../hooks/useTrainingPlan';
import { useSyncStatus } from '../hooks/useSyncStatus';
import SyncIndicator from '../components/SyncIndicator';
import type { AppStackParamList } from '../navigation/types';
import { colors, spacing, radius, fontSize } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Dashboard'>;

/** Map a workout intensity to a color for the badge / accent bar. */
function intensityColor(intensity: string): string {
  switch (intensity?.toLowerCase()) {
    case 'easy':
      return colors.accent;
    case 'moderate':
      return '#F5A623';
    case 'hard':
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function LastRideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.cardLabel}>LAST RIDE</Text>
      <Text style={styles.cardDate}>{ride.ride_date ?? ''}</Text>
      <View style={styles.statsRow}>
        <Stat label="Distance" value={ride.distance_km != null ? `${ride.distance_km.toFixed(1)} km` : '—'} />
        <Stat label="Duration" value={formatDuration(ride.duration_sec)} />
        <Stat label="Avg power" value={ride.avg_power_w != null ? `${Math.round(ride.avg_power_w)} W` : '—'} />
      </View>
      <Text style={styles.tapHint}>Tap for AI analysis →</Text>
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WorkoutCard({ workout }: { workout: Workout }) {
  const color = intensityColor(workout.intensity);
  return (
    <View style={styles.workoutCard}>
      <View style={[styles.intensityBar, { backgroundColor: color }]} />
      <View style={styles.workoutBody}>
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutDay}>{workout.day}</Text>
          <View style={[styles.intensityBadge, { backgroundColor: color }]}>
            <Text style={styles.intensityBadgeText}>{workout.intensity}</Text>
          </View>
        </View>
        <Text style={styles.workoutType}>
          {workout.type} · {workout.duration_min} min
        </Text>
        {workout.description ? (
          <Text style={styles.workoutDescription}>{workout.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const { name, lastRide, plan, loading, generating, error, refresh, generatePlan } =
    useTrainingPlan();
  const { isSyncing, newActivitiesAvailable, syncError, acknowledge } = useSyncStatus();
  const [bannerVisible, setBannerVisible] = useState(false);

  // Refetch whenever the dashboard comes into focus (e.g. after syncing rides
  // or connecting Strava on another screen).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Surface a banner when a new ride lands while the user is here; auto-dismiss
  // after 10s. The icon's badge dot stays until the data is actually reloaded.
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

  const workouts = plan?.plan_json?.workouts ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{name || '…'}</Text>
          </View>
          <View style={styles.headerActions}>
            <SyncIndicator
              isSyncing={isSyncing}
              newActivitiesAvailable={newActivitiesAvailable}
              syncError={!!syncError}
              onPress={() => navigation.navigate('StravaConnect')}
            />
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} hitSlop={8}>
              <Text style={styles.headerLink}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {bannerVisible ? (
          <TouchableOpacity style={styles.banner} activeOpacity={0.8} onPress={handleBannerRefresh}>
            <Text style={styles.bannerText}>New activity synced</Text>
            <Text style={styles.bannerAction}>Refresh</Text>
          </TouchableOpacity>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {lastRide ? (
          <LastRideCard
            ride={lastRide}
            onPress={() => navigation.navigate('RideDetail', { stravaId: lastRide.strava_id })}
          />
        ) : (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => navigation.navigate('StravaConnect')}
          >
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.mutedText}>Connect Strava and sync to see your rides.</Text>
          </TouchableOpacity>
        )}

        <View style={styles.planHeader}>
          <Text style={styles.sectionTitle}>This week's plan</Text>
          {plan?.plan_json?.summary ? (
            <Text style={styles.mutedText}>{plan.plan_json.summary}</Text>
          ) : null}
        </View>

        {loading && !plan ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : workouts.length > 0 ? (
          workouts.map((workout, index) => (
            <WorkoutCard key={`${workout.day}-${index}`} workout={workout} />
          ))
        ) : (
          <Text style={styles.mutedText}>
            No plan yet. Generate one based on your recent rides.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, generating && styles.buttonDisabled]}
          activeOpacity={0.85}
          disabled={generating}
          onPress={generatePlan}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {plan ? 'Generate new plan' : 'Generate plan'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Progress')}
        >
          <Text style={styles.secondaryButtonText}>View progress & records</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Periodization')}
        >
          <Text style={styles.secondaryButtonText}>Season plan structure</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  greeting: { color: colors.textMuted, fontSize: fontSize.md },
  name: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '800' },
  headerLink: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  error: { color: colors.danger, fontSize: fontSize.sm },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(252,76,2,0.12)',
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  bannerAction: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { color: colors.accent, fontSize: fontSize.sm, fontWeight: '700', letterSpacing: 1 },
  cardDate: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  tapHint: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  stat: { alignItems: 'flex-start' },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', marginBottom: 4 },

  planHeader: { marginTop: spacing.sm, gap: 4 },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  mutedText: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
  loader: { marginVertical: spacing.lg },

  workoutCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  intensityBar: { width: 5 },
  workoutBody: { flex: 1, padding: spacing.md },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutDay: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  intensityBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  intensityBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  workoutType: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textTransform: 'capitalize' },
  workoutDescription: { color: colors.text, fontSize: fontSize.sm, marginTop: spacing.sm, lineHeight: 20 },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
});
