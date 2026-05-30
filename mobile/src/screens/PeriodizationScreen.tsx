import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, apiOrigin, ApiResponse } from '../services/api';
import { lightColors, spacing, radius, fontSize } from '../theme';

interface DayPlan {
  day: string;
  workout_type: string;
  duration_min: number | null;
  intensity_zone: string;
  notes: string;
}
interface KeyWorkout {
  name: string;
  description: string;
  goal: string;
}
interface PeriodizationPlan {
  phase: string;
  phase_name: string;
  phase_description: string;
  weeks_remaining: number;
  target_event_date: string | null;
  training_days_per_week: number;
  weekly_structure: DayPlan[];
  tss_target: number | null;
  key_workouts: KeyWorkout[];
  avoid: string[];
}

const PHASE_COLOR: Record<string, string> = {
  base: lightColors.fitness,
  build: '#F5A623',
  peak: lightColors.fatigue,
  taper: lightColors.form,
};

function isRestDay(d: DayPlan): boolean {
  return /rest|recovery|off/i.test(d.workout_type) || !d.duration_min;
}

export default function PeriodizationScreen() {
  const [plan, setPlan] = useState<PeriodizationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<PeriodizationPlan>>(
          `${apiOrigin}/periodization/plan`
        );
        setPlan(data.data ?? null);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Failed to load plan.');
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={lightColors.primary} />
        <Text style={styles.muted}>Building your season plan…</Text>
      </SafeAreaView>
    );
  }
  if (error || !plan) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <Text style={styles.error}>{error ?? 'No plan available.'}</Text>
      </SafeAreaView>
    );
  }

  const phaseColor = PHASE_COLOR[plan.phase] ?? lightColors.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Phase header */}
        <View style={[styles.phaseCard, { borderLeftColor: phaseColor }]}>
          <View style={styles.phaseHeader}>
            <Text style={[styles.phaseBadge, { color: phaseColor }]}>{plan.phase_name.toUpperCase()} PHASE</Text>
            <Text style={styles.phaseWeeks}>
              {plan.weeks_remaining} {plan.weeks_remaining === 1 ? 'week' : 'weeks'}
              {plan.target_event_date ? ' to event' : ' block'}
            </Text>
          </View>
          <Text style={styles.phaseDesc}>{plan.phase_description}</Text>
          <View style={styles.phaseMeta}>
            {plan.tss_target != null ? <Text style={styles.metaChip}>{plan.tss_target} TSS / week</Text> : null}
            <Text style={styles.metaChip}>{plan.training_days_per_week} days / week</Text>
          </View>
        </View>

        {/* Weekly calendar */}
        <Text style={styles.sectionHeading}>This week</Text>
        {plan.weekly_structure.map((d, i) => {
          const rest = isRestDay(d);
          return (
            <View key={`${d.day}-${i}`} style={[styles.dayCard, rest && styles.dayCardRest]}>
              <View style={styles.dayCol}>
                <Text style={styles.dayName}>{d.day.slice(0, 3)}</Text>
                {d.intensity_zone && !rest ? (
                  <Text style={[styles.zoneTag, { color: phaseColor }]}>{d.intensity_zone}</Text>
                ) : null}
              </View>
              <View style={styles.dayBody}>
                <Text style={styles.workoutType}>
                  {d.workout_type}
                  {d.duration_min ? ` · ${d.duration_min} min` : ''}
                </Text>
                {d.notes ? <Text style={styles.dayNotes}>{d.notes}</Text> : null}
              </View>
            </View>
          );
        })}

        {/* Key workouts */}
        {plan.key_workouts.length ? (
          <>
            <Text style={styles.sectionHeading}>Key workouts</Text>
            {plan.key_workouts.map((k, i) => (
              <View key={`${k.name}-${i}`} style={styles.card}>
                <Text style={styles.keyName}>{k.name}</Text>
                <Text style={styles.keyDesc}>{k.description}</Text>
                {k.goal ? <Text style={styles.keyGoal}>Goal: {k.goal}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {/* Avoid */}
        {plan.avoid.length ? (
          <View style={[styles.card, styles.avoidCard]}>
            <Text style={styles.avoidLabel}>AVOID THIS PHASE</Text>
            {plan.avoid.map((a, i) => (
              <Text key={i} style={styles.avoidItem}>• {a}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  muted: { color: lightColors.textMuted, fontSize: fontSize.sm },
  error: { color: lightColors.fatigue, fontSize: fontSize.md, padding: spacing.lg, textAlign: 'center' },

  phaseCard: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderLeftWidth: 5,
    padding: spacing.lg,
  },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseBadge: { fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 1 },
  phaseWeeks: { color: lightColors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  phaseDesc: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
  phaseMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metaChip: {
    color: lightColors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    backgroundColor: lightColors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    overflow: 'hidden',
  },

  sectionHeading: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },

  dayCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  dayCardRest: { opacity: 0.6 },
  dayCol: { width: 44, alignItems: 'center' },
  dayName: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '800' },
  zoneTag: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  dayBody: { flex: 1 },
  workoutType: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '600' },
  dayNotes: { color: lightColors.textMuted, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },

  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
  },
  keyName: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '700' },
  keyDesc: { color: lightColors.text, fontSize: fontSize.sm, marginTop: 2, lineHeight: 20 },
  keyGoal: { color: lightColors.textMuted, fontSize: fontSize.sm, marginTop: 4, fontStyle: 'italic' },

  avoidCard: { backgroundColor: '#FDECEA', borderColor: '#F5C6C0' },
  avoidLabel: { color: lightColors.fatigue, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  avoidItem: { color: lightColors.text, fontSize: fontSize.sm, lineHeight: 20 },
});
