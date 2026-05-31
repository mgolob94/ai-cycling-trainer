import { useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { useTrainingPlan, type Workout } from '../hooks/useTrainingPlan';
import { Text, Card, Badge, Button, SectionHeader, SkeletonLoader, Emoji } from '../components/ui';
import { spacing, radius, palette } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';

type BadgeColor = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

function isRestDay(w: Workout): boolean {
  return w.type?.toLowerCase() === 'rest' || w.duration_min === 0;
}

function intensityBadge(intensity: string): BadgeColor {
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

function intensityBar(intensity: string): string {
  switch (intensity?.toLowerCase()) {
    case 'easy':
      return palette.sky400;
    case 'moderate':
      return palette.emerald400;
    case 'hard':
      return palette.amber400;
    default:
      return palette.indigo400;
  }
}

function typeIcon(type: string): keyof typeof Feather.glyphMap {
  const t = type?.toLowerCase() || '';
  if (t.includes('rest')) return 'coffee';
  if (t.includes('recovery')) return 'wind';
  if (t.includes('long')) return 'map';
  if (t.includes('vo2') || t.includes('interval') || t.includes('threshold') || t.includes('sweet')) return 'zap';
  return 'activity';
}

function durationLabel(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m} min`;
}

function formatWeek(iso?: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function WorkoutCard({ workout }: { workout: Workout }) {
  const { colors } = useThemeColors();
  const isToday = workout.day === todayWeekday;
  const rest = isRestDay(workout);

  return (
    <Card variant={isToday ? 'raised' : 'default'} padding={0} style={styles.card}>
      <View style={[styles.bar, { backgroundColor: rest ? colors.border : intensityBar(workout.intensity) }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitle}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRaised }]}>
              <Feather name={typeIcon(workout.type)} size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <View style={styles.dayRow}>
                <Text variant="body" style={styles.day}>
                  {workout.day}
                </Text>
                {isToday ? <Badge label="Today" color="indigo" /> : null}
              </View>
              <Text variant="caption" color={colors.textTertiary}>
                {workout.type}
                {rest ? '' : ` · ${durationLabel(workout.duration_min)}`}
              </Text>
            </View>
          </View>
          {!rest ? <Badge label={workout.intensity} color={intensityBadge(workout.intensity)} /> : null}
        </View>
        {workout.description ? (
          <Text variant="caption" color={colors.textSecondary} style={styles.desc}>
            {workout.description}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export default function PlanScreen() {
  const { colors } = useThemeColors();
  const { plan, loading, generating, error, generatePlan, refresh } = useTrainingPlan();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const workouts = plan?.plan_json?.workouts ?? [];
  const summary = plan?.plan_json?.summary;
  const weekStart = plan?.plan_json?.week_start ?? plan?.week_start;
  const totalMin = workouts.reduce((s, w) => s + (w.duration_min || 0), 0);
  const trainingDays = workouts.filter((w) => !isRestDay(w)).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.textSecondary} />}
      >
        {loading ? (
          <>
            <SkeletonLoader height={88} borderRadius={radius.lg} />
            <SkeletonLoader height={96} borderRadius={radius.lg} />
            <SkeletonLoader height={96} borderRadius={radius.lg} />
          </>
        ) : workouts.length === 0 ? (
          <Card variant="tinted" style={styles.empty}>
            <Emoji size={28}>🗓️</Emoji>
            <Text variant="bodyLarge" style={styles.emptyTitle}>
              No plan yet
            </Text>
            <Text variant="caption" color={colors.textSecondary} style={styles.emptyText}>
              {error ?? 'Generate a personalized week of training from your recent rides and fitness.'}
            </Text>
            <Button label="Generate plan" variant="primary" size="md" loading={generating} onPress={generatePlan} />
          </Card>
        ) : (
          <>
            {/* Week overview */}
            <Card variant="dark" padding={20}>
              <Text variant="label" color={palette.slate400}>
                WEEK OF {formatWeek(weekStart)?.toUpperCase()}
              </Text>
              {summary ? (
                <Text variant="body" color="#FFFFFF" style={styles.summary}>
                  {summary}
                </Text>
              ) : null}
              <View style={styles.overviewStats}>
                <View style={styles.overviewStat}>
                  <Text variant="statSm" color="#FFFFFF">
                    {trainingDays}
                  </Text>
                  <Text variant="label" color={palette.slate400}>
                    Training days
                  </Text>
                </View>
                <View style={styles.overviewStat}>
                  <Text variant="statSm" color="#FFFFFF">
                    {durationLabel(totalMin) || '0'}
                  </Text>
                  <Text variant="label" color={palette.slate400}>
                    Total time
                  </Text>
                </View>
              </View>
            </Card>

            {/* Workouts */}
            <View style={styles.section}>
              <SectionHeader title="WORKOUTS" />
              <View style={styles.list}>
                {workouts.map((w, i) => (
                  <WorkoutCard key={`${w.day}-${i}`} workout={w} />
                ))}
              </View>
            </View>

            <Button label="Generate a new plan" variant="ghost" size="md" loading={generating} onPress={generatePlan} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[12], gap: spacing[4] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyTitle: { fontWeight: '700' },
  emptyText: { textAlign: 'center', lineHeight: 20, marginBottom: spacing[2], paddingHorizontal: spacing[4] },

  summary: { marginTop: spacing[2], lineHeight: 22 },
  overviewStats: { flexDirection: 'row', gap: spacing[8], marginTop: spacing[4] },
  overviewStat: { gap: 2 },

  section: { gap: 0 },
  list: { gap: spacing[2] },

  card: { flexDirection: 'row', overflow: 'hidden' },
  bar: { width: 4 },
  cardBody: { flex: 1, padding: spacing[4], gap: spacing[2] },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  day: { fontWeight: '600' },
  desc: { lineHeight: 19 },
});
