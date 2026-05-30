import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../navigation/types';
import { useFtp } from '../hooks/useFtp';
import { useWeeklyMetrics, type WeeklyMetric } from '../hooks/useWeeklyMetrics';
import { usePersonalRecords, type PersonalRecord } from '../hooks/usePersonalRecords';
import MultiLineChart from '../components/MultiLineChart';
import FTPChart from '../components/FTPChart';
import { scheduleWeeklySummary } from '../services/notifications';
import { lightColors, spacing, radius, fontSize } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function mondayOfNow(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return d.toISOString().slice(0, 10);
}

function isRecent(iso: string | null, days = 14): boolean {
  if (!iso) return false;
  const ms = Date.now() - new Date(`${iso}T00:00:00`).getTime();
  return ms >= 0 && ms <= days * 24 * 3600 * 1000;
}

const RECORD_META: Record<string, { label: string; icon: string }> = {
  best_5min_power: { label: '5 min power', icon: '⚡' },
  best_20min_power: { label: '20 min power', icon: '⚡' },
  best_60min_power: { label: '1 hr power', icon: '⚡' },
  longest_ride_km: { label: 'Longest ride', icon: '🚴' },
  most_elevation_m: { label: 'Most climbing', icon: '⛰️' },
};

function formatRecord(record: PersonalRecord): string {
  const unit = record.unit === 'watts' ? 'W' : record.unit;
  return `${record.value} ${unit}`;
}

function FtpCard() {
  const { ftp, history, loading, running, error, runTest } = useFtp();
  return (
    <View style={[styles.card, styles.ftpCard]}>
      <Text style={styles.cardLabel}>FUNCTIONAL THRESHOLD POWER</Text>
      {loading ? (
        <ActivityIndicator color={lightColors.primary} style={{ marginVertical: spacing.lg }} />
      ) : (
        <>
          <View style={styles.ftpValueRow}>
            <Text style={styles.ftpValue}>{ftp ? ftp.ftp_watts : '—'}</Text>
            <Text style={styles.ftpUnit}>watts</Text>
          </View>
          <View style={styles.ftpMetaRow}>
            <Text style={styles.ftpMeta}>
              {ftp?.watts_per_kg != null ? `${ftp.watts_per_kg} W/kg` : 'W/kg —'}
            </Text>
            <Text style={styles.ftpMeta}>Last test: {shortDate(ftp?.test_date ?? null)}</Text>
          </View>

          {history.length > 0 ? (
            <View style={styles.ftpChartWrap}>
              <FTPChart history={history} />
            </View>
          ) : null}
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.primaryButton, running && styles.buttonDisabled]}
        activeOpacity={0.85}
        disabled={running}
        onPress={runTest}
      >
        {running ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Run FTP test</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function FitnessChart({ weeks, loading }: { weeks: WeeklyMetric[]; loading: boolean }) {
  const width = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Fitness, fatigue & form</Text>
      {loading ? (
        <ActivityIndicator color={lightColors.primary} style={{ marginVertical: spacing.xl }} />
      ) : (
        <MultiLineChart
          width={width}
          labels={weeks.map((w) => shortDate(w.week_start))}
          series={[
            { color: lightColors.fitness, values: weeks.map((w) => w.ctl) },
            { color: lightColors.fatigue, values: weeks.map((w) => w.atl) },
            { color: lightColors.form, values: weeks.map((w) => w.tsb) },
          ]}
        />
      )}
      <View style={styles.legendRow}>
        <Legend color={lightColors.fitness} label="Fitness (CTL)" />
        <Legend color={lightColors.fatigue} label="Fatigue (ATL)" />
        <Legend color={lightColors.form} label="Form (TSB)" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function WeeklyCards({ weeks }: { weeks: WeeklyMetric[] }) {
  const currentMonday = mondayOfNow();
  return (
    <View>
      <Text style={styles.sectionHeading}>Weekly summary</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekScroll}
      >
        {weeks.map((w) => {
          const current = w.week_start === currentMonday;
          return (
            <View key={w.week_start} style={[styles.weekCard, current && styles.weekCardCurrent]}>
              <Text style={[styles.weekDate, current && styles.weekTextCurrent]}>
                {shortDate(w.week_start)}
                {current ? ' • now' : ''}
              </Text>
              <Text style={[styles.weekTss, current && styles.weekTextCurrent]}>
                {Math.round(w.tss)}
              </Text>
              <Text style={[styles.weekTssLabel, current && styles.weekTextCurrent]}>TSS</Text>
              <View style={styles.weekStats}>
                <Text style={[styles.weekStat, current && styles.weekTextCurrent]}>
                  {Math.round(w.total_distance_km)} km
                </Text>
                <Text style={[styles.weekStat, current && styles.weekTextCurrent]}>
                  {Math.round(w.total_elevation_m)} m
                </Text>
                <Text style={[styles.weekStat, current && styles.weekTextCurrent]}>
                  {w.ride_count} {w.ride_count === 1 ? 'ride' : 'rides'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RecordsGrid({ records }: { records: PersonalRecord[] }) {
  return (
    <View>
      <Text style={styles.sectionHeading}>Personal records</Text>
      <View style={styles.recordsGrid}>
        {records.map((r) => {
          const meta = RECORD_META[r.record_type] ?? { label: r.record_type, icon: '🏅' };
          const recent = isRecent(r.achieved_date);
          return (
            <View key={r.record_type} style={styles.recordCard}>
              {recent ? (
                <View style={styles.goldBadge}>
                  <Text style={styles.goldBadgeText}>NEW</Text>
                </View>
              ) : null}
              <Text style={styles.recordIcon}>{meta.icon}</Text>
              <Text style={styles.recordValue}>{formatRecord(r)}</Text>
              <Text style={styles.recordLabel}>{meta.label}</Text>
              <Text style={styles.recordDate}>{shortDate(r.achieved_date)}</Text>
            </View>
          );
        })}
        {records.length === 0 ? (
          <Text style={styles.mutedText}>No records yet — sync some rides.</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const ftp = useFtp();
  const metrics = useWeeklyMetrics();
  const records = usePersonalRecords();

  const refreshing = ftp.loading || metrics.loading || records.loading;
  const onRefresh = () => {
    ftp.refresh();
    metrics.refresh();
    records.refresh();
  };

  // Refresh the Sunday-evening weekly summary notification with the latest
  // week's totals (no-op if notifications aren't granted).
  useEffect(() => {
    const latest = metrics.weeks[metrics.weeks.length - 1];
    if (latest) {
      scheduleWeeklySummary(latest.total_distance_km, latest.tss).catch(() => {});
    }
  }, [metrics.weeks]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lightColors.primary} />
        }
      >
        <FtpCard />
        <TouchableOpacity
          style={styles.compareButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('WeeklyComparison')}
        >
          <Text style={styles.compareButtonText}>Compare weeks →</Text>
        </TouchableOpacity>
        <FitnessChart weeks={metrics.weeks} loading={metrics.loading} />
        {metrics.loading ? null : <WeeklyCards weeks={metrics.weeks} />}
        {records.loading ? (
          <ActivityIndicator color={lightColors.primary} style={{ marginTop: spacing.lg }} />
        ) : (
          <RecordsGrid records={records.records} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },

  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  cardLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  sectionHeading: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  mutedText: { color: lightColors.textMuted, fontSize: fontSize.md },
  error: { color: lightColors.fatigue, fontSize: fontSize.sm, marginTop: spacing.sm },

  ftpCard: { alignItems: 'flex-start' },
  ftpValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  ftpValue: { color: lightColors.text, fontSize: 56, fontWeight: '800', lineHeight: 60 },
  ftpUnit: { color: lightColors.textMuted, fontSize: fontSize.md, marginBottom: 10, marginLeft: 6 },
  ftpMetaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  ftpMeta: { color: lightColors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  ftpChartWrap: { alignSelf: 'stretch', marginTop: spacing.md },
  compareButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  compareButtonText: { color: lightColors.primary, fontSize: fontSize.md, fontWeight: '700' },

  primaryButton: {
    backgroundColor: lightColors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: lightColors.textMuted, fontSize: fontSize.sm },

  weekScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  weekCard: {
    width: 130,
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
  },
  weekCardCurrent: { backgroundColor: lightColors.primary, borderColor: lightColors.primary },
  weekTextCurrent: { color: '#fff' },
  weekDate: { color: lightColors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  weekTss: { color: lightColors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.xs },
  weekTssLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '700' },
  weekStats: { marginTop: spacing.sm, gap: 2 },
  weekStat: { color: lightColors.text, fontSize: fontSize.sm },

  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recordCard: {
    width: '48%',
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
  },
  recordIcon: { fontSize: 22 },
  recordValue: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '800', marginTop: 4 },
  recordLabel: { color: lightColors.text, fontSize: fontSize.sm, fontWeight: '600', marginTop: 2 },
  recordDate: { color: lightColors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  goldBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: lightColors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  goldBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
