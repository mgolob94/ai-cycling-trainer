import { View, StyleSheet } from 'react-native';

import { Text, Card, SectionHeader } from '../ui';
import { interpretWeeklyTSS } from '../../services/metricsInterpreter';
import type { WeeklyMetric } from '../../hooks/useWeeklyMetrics';
import { palette, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  week: WeeklyMetric;
  prevWeek?: WeeklyMetric | null;
  avgTss?: number;
  /** Weekly TSS target; defaults to the 4-week average (maintenance). */
  tssGoal?: number;
}

function weekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function trendArrow(curr: number, prev: number | undefined): string {
  if (prev == null) return '';
  if (curr > prev * 1.02) return ' ↑';
  if (curr < prev * 0.98) return ' ↓';
  return '';
}

function MiniStat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.miniStat}>
      <Text variant="statSm" color={colors.textPrimary}>
        {value}
      </Text>
      <Text variant="label" color={palette.slate400}>
        {label}
      </Text>
    </View>
  );
}

/** Plain-language summary of the current training week. */
export default function WeekSummaryCard({ week, prevWeek = null, avgTss = 0, tssGoal }: Props) {
  const { colors } = useTheme();
  const info = interpretWeeklyTSS(week.tss, avgTss);
  const goal = tssGoal ?? (avgTss > 0 ? Math.round(avgTss / 25) * 25 : 300);
  const pct = goal > 0 ? Math.min(100, Math.round((week.tss / goal) * 100)) : 0;
  const remaining = Math.max(0, Math.round(goal - week.tss));
  const reached = week.tss >= goal;
  const needsRecovery = /hard/i.test(info.label);

  return (
    <Card variant="raised">
      <View style={styles.headerRow}>
        <SectionHeader title="THIS WEEK" />
        <Text variant="caption" color={palette.slate400}>
          {weekRange(week.week_start)}
        </Text>
      </View>

      <Text variant="heading3" color={colors.textPrimary}>
        {info.label}
      </Text>
      <Text variant="caption" color={palette.slate400} style={styles.vsAvg}>
        {info.vsAverage}
      </Text>

      <View style={styles.stats}>
        <MiniStat value={`${Math.round(week.total_distance_km)} km${trendArrow(week.total_distance_km, prevWeek?.total_distance_km)}`} label="Distance" />
        <MiniStat value={`${Math.round(week.total_elevation_m)} m${trendArrow(week.total_elevation_m, prevWeek?.total_elevation_m)}`} label="Elevation" />
        <MiniStat value={`${week.ride_count}`} label={week.ride_count === 1 ? 'Ride' : 'Rides'} />
      </View>

      {/* TSS goal progress */}
      <View style={styles.goalRow}>
        <Text variant="label" color={palette.slate400}>
          GOAL {goal} TSS
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {Math.round(week.tss)} TSS ({pct}%)
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: palette.indigo400 }]} />
      </View>
      <Text variant="caption" color={reached ? palette.emerald600 : colors.textSecondary} style={styles.goalLabel}>
        {reached ? 'Goal reached ✓' : `${remaining} TSS to go`}
      </Text>

      {needsRecovery ? (
        <View style={[styles.recoveryChip, { backgroundColor: colors.surfaceRaised }]}>
          <Text variant="caption" color={colors.textPrimary}>
            💡 Next week: consider a recovery week
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vsAvg: { marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: spacing[4], marginBottom: spacing[4] },
  miniStat: { flex: 1, gap: 2 },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  barTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: radius.full },
  goalLabel: { marginTop: spacing[2] },
  recoveryChip: { marginTop: spacing[3], borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], alignSelf: 'flex-start' },
});
