import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { useTrainingPlan, type Workout, type TrainingPlan, type PhaseResult } from '../hooks/useTrainingPlan';
import { api, type ApiResponse } from '../services/api';
import EventSetup from '../components/plan/EventSetup';
import PlanReasoningCard from '../components/plan/PlanReasoningCard';
import { Text, Card, Badge, Button, SectionHeader, SkeletonLoader, Emoji } from '../components/ui';
import { spacing, radius, palette, zoneColors } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';

type BadgeColor = 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';

const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

const PHASE_META: Record<string, { label: string; color: BadgeColor }> = {
  base: { label: 'Base', color: 'sky' },
  build: { label: 'Build', color: 'emerald' },
  peak: { label: 'Peak', color: 'amber' },
  recovery: { label: 'Recovery', color: 'default' },
  taper: { label: 'Taper', color: 'rose' },
};

const isRestDay = (w: Workout) => w.type?.toLowerCase() === 'rest' || w.duration_min === 0;

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

function zoneColor(w: Workout): string {
  const z = w.zone;
  if (z && (zoneColors as Record<string, string>)[`z${z}`]) return (zoneColors as Record<string, string>)[`z${z}`];
  switch (w.intensity?.toLowerCase()) {
    case 'easy':
      return zoneColors.z2;
    case 'moderate':
      return zoneColors.z3;
    case 'hard':
      return zoneColors.z5;
    default:
      return zoneColors.z2;
  }
}

function durationLabel(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m} min`;
}

const fmtWeek = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

function WorkoutCard({ workout }: { workout: Workout }) {
  const { colors } = useThemeColors();
  const isToday = workout.day === todayWeekday;
  const rest = isRestDay(workout);

  if (rest) {
    return (
      <View style={styles.restRow}>
        <Text variant="caption" color={colors.textTertiary}>
          {workout.day} · Rest
        </Text>
      </View>
    );
  }

  return (
    <Card variant={isToday ? 'raised' : 'default'} padding={0} style={[styles.card, isToday && { borderColor: colors.primary, borderWidth: 1.5 }]}>
      <View style={[styles.bar, { backgroundColor: zoneColor(workout) }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={styles.flex}>
            <View style={styles.dayRow}>
              <Text variant="body" style={styles.bold}>
                {workout.day}
              </Text>
              {workout.is_key_workout ? <Emoji size={13}>⭐</Emoji> : null}
              {isToday ? <Badge label="Today" color="emerald" /> : null}
            </View>
            <Text variant="caption" color={colors.textTertiary}>
              {workout.type} · {durationLabel(workout.duration_min)}
            </Text>
          </View>
          <Badge label={workout.intensity} color={intensityBadge(workout.intensity)} />
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

function historyDot(pct: number | undefined, phase?: string): string {
  if (phase === 'recovery') return palette.slate400;
  if (pct == null) return palette.slate200;
  if (pct >= 90) return zoneColors.z3;
  if (pct >= 60) return zoneColors.z4;
  return zoneColors.z6;
}

export default function PlanScreen() {
  const { colors } = useThemeColors();
  const { plan, loading, generating, error, generatePlan, refresh } = useTrainingPlan();
  const [phase, setPhase] = useState<PhaseResult | null>(null);
  const [history, setHistory] = useState<TrainingPlan[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [adaptation, setAdaptation] = useState<string | null>(null);

  const loadExtras = useCallback(async () => {
    try {
      const [ph, hist, adapt] = await Promise.all([
        api.get<ApiResponse<PhaseResult>>('/plans/phase'),
        api.get<ApiResponse<TrainingPlan[]>>('/plans'),
        api.get<ApiResponse<{ adapted: boolean; reason: string | null }>>('/plans/adaptation-status'),
      ]);
      setPhase(ph.data.data ?? null);
      setHistory((hist.data.data ?? []).slice(0, 8));
      setAdaptation(adapt.data.data?.adapted ? adapt.data.data.reason : null);
    } catch {
      // non-fatal
    }
  }, []);

  const dismissAdaptation = useCallback(() => {
    setAdaptation(null);
    api.post('/plans/adaptation-status/dismiss').catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadExtras();
    }, [refresh, loadExtras])
  );

  const workouts = plan?.plan_json?.workouts ?? [];
  const strength = plan?.plan_json?.strength_sessions ?? [];
  const coachIntro = plan?.coach_intro ?? plan?.plan_json?.coach_intro;
  const reasoning = plan?.reasoning ?? plan?.plan_json?.reasoning;
  const phaseKey = (phase?.phase ?? plan?.phase ?? plan?.plan_json?.phase ?? '').toLowerCase();
  const meta = PHASE_META[phaseKey];
  const phaseWeek = phase?.phase_week ?? plan?.phase_week ?? plan?.plan_json?.phase_week;
  const phaseTotal = phase?.phase_total_weeks ?? plan?.phase_total_weeks ?? plan?.plan_json?.phase_total_weeks;
  const progress = phaseWeek && phaseTotal ? Math.min(1, phaseWeek / phaseTotal) : 0;
  const hasEvent = phase != null && phase.weeks_to_event != null;
  const noEvent = phase != null && phase.weeks_to_event == null;
  const eventName = phase?.event_name ?? null;

  const toggleHistory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowHistory((s) => !s);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { refresh(); loadExtras(); }} tintColor={colors.textSecondary} />}
      >
        {/* SECTION 1 — Phase header */}
        {meta ? (
          <Card variant="default" style={styles.phaseCard}>
            <View style={styles.phaseTop}>
              <Badge label={meta.label} color={meta.color} />
              <Text variant="caption" color={colors.textSecondary} style={styles.flex}>
                {phaseWeek != null && phaseTotal != null ? `Week ${phaseWeek} of ${phaseTotal}` : ''}
              </Text>
              {phase?.weeks_to_event != null ? (
                <Text variant="caption" color={colors.primary} style={styles.bold}>
                  {phase.weeks_to_event} wk to event
                </Text>
              ) : null}
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceRaised }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            {phase?.rationale ? (
              <Text variant="caption" color={colors.textTertiary} style={styles.rationale}>
                {phase.rationale}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* Goal / event CTA — prominent when no event, compact edit when set */}
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
                  Racing a Gran Fondo or sportif? The coach plans backwards from the date.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.primary} />
            </Card>
          </Pressable>
        ) : hasEvent ? (
          <Pressable onPress={() => setEventOpen(true)} style={styles.editGoal} hitSlop={6}>
            <Feather name="flag" size={14} color={colors.primary} />
            <Text variant="caption" color={colors.primary} style={styles.bold}>
              {eventName ? `${eventName} · Edit goal` : 'Edit goal'}
            </Text>
          </Pressable>
        ) : null}

        {/* SECTION 2 — This week */}
        {loading ? (
          <>
            <SkeletonLoader height={70} borderRadius={radius.lg} />
            <SkeletonLoader height={88} borderRadius={radius.lg} />
            <SkeletonLoader height={88} borderRadius={radius.lg} />
          </>
        ) : workouts.length === 0 ? (
          <Card variant="tinted" style={styles.empty}>
            <Emoji size={28}>🗓️</Emoji>
            <Text variant="bodyLarge" style={styles.bold}>
              No plan yet
            </Text>
            <Text variant="caption" color={colors.textSecondary} style={styles.emptyText}>
              {error ?? 'Generate a personalized week from your fitness and current phase.'}
            </Text>
            <Button label="Generate plan" variant="primary" size="md" loading={generating} onPress={generatePlan} />
          </Card>
        ) : (
          <>
            {adaptation ? (
              <View style={[styles.adaptBanner, { backgroundColor: colors.surfaceRaised, borderLeftColor: colors.primary }]}>
                <View style={styles.adaptHead}>
                  <Text variant="caption" color={colors.textPrimary} style={styles.bold}>
                    Plan updated · Here's why
                  </Text>
                  <Pressable onPress={dismissAdaptation} hitSlop={10}>
                    <Text variant="caption" color={colors.primary} style={styles.bold}>
                      Got it
                    </Text>
                  </Pressable>
                </View>
                <Text variant="caption" color={colors.textSecondary} style={styles.adaptBody}>
                  {adaptation}
                </Text>
              </View>
            ) : null}

            {reasoning ? (
              <PlanReasoningCard reasoning={reasoning} generatedAt={plan?.generated_at} onRefresh={generatePlan} />
            ) : coachIntro ? (
              <Card variant="tinted">
                <Text variant="body" color={colors.textPrimary} style={styles.intro}>
                  {coachIntro}
                </Text>
              </Card>
            ) : null}

            <View style={styles.section}>
              <SectionHeader title="THIS WEEK" />
              <View style={styles.list}>
                {workouts.map((w, i) => (
                  <WorkoutCard key={`${w.day}-${i}`} workout={w} />
                ))}
              </View>
            </View>

            {strength.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title="STRENGTH" />
                <View style={styles.list}>
                  {strength.map((s, i) => (
                    <Card key={`${s.day}-${i}`} variant="default" style={styles.strengthCard}>
                      <View style={styles.dayRow}>
                        <Emoji size={15}>🏋️</Emoji>
                        <Text variant="body" style={styles.bold}>
                          {s.day}
                        </Text>
                        <View style={styles.flex} />
                        <Badge label={`${s.duration_min} min`} color="emerald" />
                      </View>
                      <Text variant="caption" color={colors.textTertiary}>
                        {s.focus}
                      </Text>
                      {s.exercises?.length ? (
                        <Text variant="caption" color={colors.textSecondary} style={styles.desc}>
                          {s.exercises.join(' · ')}
                        </Text>
                      ) : null}
                    </Card>
                  ))}
                </View>
              </View>
            ) : null}

            <Button label="Generate a new plan" variant="ghost" size="md" loading={generating} onPress={generatePlan} />
          </>
        )}

        {/* SECTION 3 — History (collapsible) */}
        {history.length > 0 ? (
          <View style={styles.section}>
            <Pressable style={styles.historyHeader} onPress={toggleHistory} hitSlop={6}>
              <Text variant="label" color={colors.textTertiary}>
                RECENT WEEKS
              </Text>
              <Feather name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </Pressable>
            {showHistory ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
                {history.map((h, i) => {
                  const pm = PHASE_META[(h.phase ?? h.plan_json?.phase ?? '').toLowerCase()];
                  return (
                    <Card key={h.id ?? i} variant="default" style={styles.histCard}>
                      <Text variant="caption" color={colors.textTertiary}>
                        {i === 0 ? 'This week' : fmtWeek(h.week_start)}
                      </Text>
                      {pm ? <Badge label={pm.label} color={pm.color} /> : null}
                      <View style={styles.histDotRow}>
                        <View style={[styles.histDot, { backgroundColor: historyDot(h.completion_pct, h.phase) }]} />
                        <Text variant="caption" color={colors.textSecondary}>
                          {h.completion_pct != null ? `${h.completion_pct}%` : '—'}
                        </Text>
                      </View>
                    </Card>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <EventSetup visible={eventOpen} onClose={() => setEventOpen(false)} onSaved={() => { refresh(); loadExtras(); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[12], gap: spacing[4] },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },

  phaseCard: { gap: spacing[3] },
  phaseTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  goalCta: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  goalIcon: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  editGoal: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  progressTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: radius.full },
  rationale: { lineHeight: 18 },

  intro: { lineHeight: 22 },
  adaptBanner: { borderRadius: radius.md, borderLeftWidth: 3, padding: spacing[4], gap: spacing[2] },
  adaptHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adaptBody: { lineHeight: 20 },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { textAlign: 'center', lineHeight: 20, marginBottom: spacing[2], paddingHorizontal: spacing[4] },

  section: { gap: 0 },
  list: { gap: spacing[2] },
  restRow: { paddingVertical: spacing[2], paddingHorizontal: spacing[3] },

  card: { flexDirection: 'row', overflow: 'hidden' },
  bar: { width: 4 },
  cardBody: { flex: 1, padding: spacing[4], gap: spacing[2] },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  desc: { lineHeight: 19 },
  strengthCard: { gap: spacing[2] },

  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  historyRow: { gap: spacing[2], paddingRight: spacing[4] },
  histCard: { minWidth: 110, gap: spacing[2] },
  histDotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  histDot: { width: 10, height: 10, borderRadius: radius.full },
});
