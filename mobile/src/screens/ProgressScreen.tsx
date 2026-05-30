import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
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
import AnimatedNumber from '../components/AnimatedNumber';
import PowerCurveChart from '../components/PowerCurveChart';
import FTPChart from '../components/FTPChart';
import { scheduleWeeklySummary } from '../services/notifications';
import type { AppStackParamList } from '../navigation/types';
import { lightColors, spacing, radius, fontSize } from '../theme';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function nameFrom(email?: string | null): string {
  if (!email) return 'kolesar';
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function formStatus(tsb: number | null): { label: string; color: string } {
  if (tsb == null) return { label: 'neznana', color: lightColors.textMuted };
  if (tsb > 5) return { label: 'Svež', color: lightColors.form };
  if (tsb >= -10) return { label: 'Optimalen', color: lightColors.fitness };
  if (tsb >= -30) return { label: 'Utrujen', color: '#F5A623' };
  return { label: 'Preobremenjen', color: lightColors.fatigue };
}

function riderCategory(wkg: number | null): string {
  if (wkg == null) return '—';
  if (wkg < 2.0) return 'Rekreativni';
  if (wkg < 3.0) return 'Fitnes';
  if (wkg < 4.0) return 'Amater';
  if (wkg < 5.0) return 'Napredni';
  return 'Elite';
}

function trendArrow(curr: number | undefined, prev: number | undefined): string {
  if (curr == null || prev == null) return '';
  if (curr > prev + 1) return '▲';
  if (curr < prev - 1) return '▼';
  return '▬';
}

function Skeleton({ height = 80 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

export default function ProgressScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useProfile();
  const metrics = useWeeklyMetrics();
  const ftp = useFtp();
  const rider = useRiderProfile();
  const pdc = usePowerCurve();
  const week = useWeekAnalysis();
  const recs = useRecommendations();
  const prs = usePersonalRecords();

  const [pdcRange, setPdcRange] = useState<'alltime' | '90d' | '30d'>('alltime');
  const [showFtpChart, setShowFtpChart] = useState(false);
  const [prSort, setPrSort] = useState<'recent' | 'duration' | 'alltime'>('alltime');

  const weeks = metrics.weeks;
  const current = weeks[weeks.length - 1];
  const prior4 = weeks[weeks.length - 5];
  const status = formStatus(current?.tsb ?? null);

  // Keep the Sunday weekly-summary notification current with the latest totals.
  useEffect(() => {
    if (current) {
      scheduleWeeklySummary(current.total_distance_km, current.tss).catch(() => {});
    }
  }, [current]);

  const refreshing =
    profile.loading || metrics.loading || ftp.loading || pdc.loading || prs.loading;
  const onRefresh = () => {
    profile.refresh();
    metrics.refresh();
    ftp.refresh();
    rider.refresh();
    pdc.refresh();
    week.refresh();
    recs.refresh();
    prs.refresh();
  };

  const chartWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2;
  const pdcData = pdcRange === 'alltime' ? pdc.alltime : pdcRange === '90d' ? pdc.last90 : pdc.last30;
  const wkg = ftp.ftp?.watts_per_kg ?? null;
  const ftpStale =
    !ftp.ftp?.test_date ||
    Date.now() - new Date(`${ftp.ftp.test_date}T00:00:00`).getTime() > 42 * 24 * 3600 * 1000;

  const sortedPrs = sortRecords(prs.records, prSort);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lightColors.primary} />}
      >
        {/* HEADER */}
        <View style={styles.header}>
          {metrics.loading ? (
            <Skeleton height={60} />
          ) : (
            <>
              <Text style={styles.greeting}>
                Dober dan, {nameFrom(profile.profile?.email)}! Tvoja forma je{' '}
                <Text style={{ color: status.color }}>{status.label.toLowerCase()}</Text>.
              </Text>
              <View style={styles.headerRow}>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                  <Text style={styles.statusBadgeText}>{status.label}</Text>
                </View>
                <View style={styles.tsbBox}>
                  <Text style={styles.tsbLabel}>TSB</Text>
                  <Text style={[styles.tsbValue, { color: status.color }]}>
                    {current?.tsb != null ? Math.round(current.tsb) : '—'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* SECTION 1 — fitness overview */}
        {metrics.loading ? (
          <Skeleton height={100} />
        ) : (
          <View style={styles.metricRow}>
            <MetricCard
              label="Fitnes (CTL)"
              value={current?.ctl ?? 0}
              sub={`${trendArrow(current?.ctl, prior4?.ctl)} 4 tedne`}
              color={lightColors.fitness}
            />
            <MetricCard
              label="Utrujenost (ATL)"
              value={current?.atl ?? 0}
              sub="zadnjih 7 dni"
              color="#F5A623"
            />
            <MetricCard
              label="Forma (TSB)"
              value={current?.tsb ?? 0}
              sub={status.label}
              color={status.color}
            />
          </View>
        )}

        {/* SECTION 2 — power profile */}
        <Text style={styles.sectionHeading}>Profil moči</Text>
        {ftp.loading ? (
          <Skeleton height={90} />
        ) : (
          <View style={styles.powerRow}>
            <TouchableOpacity
              style={styles.powerCard}
              activeOpacity={0.8}
              onPress={() => setShowFtpChart((v) => !v)}
            >
              <Text style={styles.powerLabel}>FTP</Text>
              <Text style={styles.powerValue}>{ftp.ftp?.ftp_watts ?? '—'} W</Text>
              <Text style={styles.powerSub}>
                {wkg != null ? `${wkg} W/kg` : 'W/kg —'}
              </Text>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{riderCategory(wkg)}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.powerCard}
              activeOpacity={0.8}
              onPress={() => Alert.alert("W'", "W' je tvoja anaerobna baterija. Nastaviš jo v FTP testu.")}
            >
              <Text style={styles.powerLabel}>W'</Text>
              <Text style={styles.powerValue}>
                {(profile.profile?.w_prime_total ?? 20000) / 1000} kJ
              </Text>
              <Text style={styles.powerSub}>anaerobna kapaciteta</Text>
            </TouchableOpacity>
          </View>
        )}
        {showFtpChart && ftp.history.length ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>FTP ZGODOVINA</Text>
            <FTPChart history={ftp.history} />
          </View>
        ) : null}

        {/* SECTION 3 — power duration curve */}
        <Text style={styles.sectionHeading}>Krivulja moči</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            {(['alltime', '90d', '30d'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.toggle, pdcRange === r && styles.toggleActive]}
                onPress={() => setPdcRange(r)}
              >
                <Text style={[styles.toggleText, pdcRange === r && styles.toggleTextActive]}>
                  {r === 'alltime' ? 'Vse' : r === '90d' ? '90 dni' : '30 dni'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {pdc.loading ? (
            <Skeleton height={200} />
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
        </View>

        {/* SECTION 4 — AI coach */}
        <Text style={styles.sectionHeading}>AI trener</Text>
        {week.loading ? (
          <Skeleton height={120} />
        ) : (
          <View style={styles.card}>
            <View style={styles.coachHeader}>
              <Text style={styles.coachAvatar}>🧠</Text>
              <Text style={styles.coachTitle}>Tedenska analiza</Text>
            </View>
            <Text style={styles.coachText}>
              {week.analysis?.summary ?? 'Sinhroniziraj vožnje za analizo trenerja.'}
            </Text>
            {week.analysis?.warning ? (
              <Text style={styles.coachWarning}>⚠︎ {week.analysis.warning}</Text>
            ) : null}

            {!recs.loading && recs.recommendations.length ? (
              <View style={styles.chipRow}>
                {recs.recommendations.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.chip}
                    onPress={() => Alert.alert(r.action_cta, r.message)}
                  >
                    <Text style={styles.chipText}>{r.action_cta}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <TouchableOpacity style={styles.coachButton} onPress={() => navigation.navigate('AIReport')}>
              <Text style={styles.coachButtonText}>Pridobi celotno analizo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SECTION 5 — personal records */}
        <Text style={styles.sectionHeading}>Osebni rekordi</Text>
        <View style={styles.prSortRow}>
          {(['recent', 'duration', 'alltime'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sortChip, prSort === s && styles.sortChipActive]}
              onPress={() => setPrSort(s)}
            >
              <Text style={[styles.sortChipText, prSort === s && styles.sortChipTextActive]}>
                {s === 'recent' ? 'Nedavni' : s === 'duration' ? 'Po dolžini' : 'Vsi časi'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {prs.loading ? (
          <Skeleton height={100} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prScroll}>
            {sortedPrs.map((r, i) => (
              <RecordCard key={r.record_type} record={r} medal={prSort === 'alltime' ? i : -1} />
            ))}
            {sortedPrs.length === 0 ? <Text style={styles.muted}>Še ni rekordov.</Text> : null}
          </ScrollView>
        )}

        {/* BOTTOM CTA */}
        <View style={styles.ctaBlock}>
          {ftpStale ? (
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('FTPTestWizard')}>
              <Text style={styles.primaryButtonText}>Zaženi FTP test</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Periodization')}>
            <Text style={styles.secondaryButtonText}>Poglej periodizacijo →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <AnimatedNumber value={value} style={[styles.metricValue, { color }]} />
      <Text style={styles.metricSub}>{sub}</Text>
    </View>
  );
}

const MEDALS = ['#E0A106', '#9CA3AF', '#B06B3A'];
const RECORD_LABELS: Record<string, string> = {
  best_5min_power: '5 min',
  best_20min_power: '20 min',
  best_60min_power: '1 ura',
  longest_ride_km: 'Najdaljša',
  most_elevation_m: 'Vzpon',
};

function RecordCard({ record, medal }: { record: PersonalRecord; medal: number }) {
  const unit = record.unit === 'watts' ? 'W' : record.unit;
  const medalColor = medal >= 0 && medal < 3 ? MEDALS[medal] : null;
  return (
    <View style={[styles.prCard, medalColor ? { borderColor: medalColor, borderWidth: 2 } : null]}>
      {medalColor ? <Text style={[styles.medal, { color: medalColor }]}>●</Text> : null}
      <Text style={styles.prValue}>
        {record.value} {unit}
      </Text>
      <Text style={styles.prLabel}>{RECORD_LABELS[record.record_type] ?? record.record_type}</Text>
    </View>
  );
}

function sortRecords(records: PersonalRecord[], mode: 'recent' | 'duration' | 'alltime'): PersonalRecord[] {
  const copy = [...records];
  if (mode === 'recent') {
    return copy.sort((a, b) => String(b.achieved_date).localeCompare(String(a.achieved_date)));
  }
  if (mode === 'duration') {
    const order = ['best_5min_power', 'best_20min_power', 'best_60min_power', 'longest_ride_km', 'most_elevation_m'];
    return copy.sort((a, b) => order.indexOf(a.record_type) - order.indexOf(b.record_type));
  }
  return copy.sort((a, b) => b.value - a.value);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  muted: { color: lightColors.textMuted, fontSize: fontSize.sm },
  skeleton: { backgroundColor: lightColors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: lightColors.border },

  header: { gap: spacing.sm },
  greeting: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', lineHeight: 26 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  statusBadgeText: { color: '#fff', fontWeight: '800', fontSize: fontSize.sm },
  tsbBox: { alignItems: 'flex-end' },
  tsbLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '700' },
  tsbValue: { fontSize: fontSize.xl, fontWeight: '800' },

  metricRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: {
    flex: 1,
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
  },
  metricLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '700' },
  metricValue: { fontSize: 30, fontWeight: '800', padding: 0, marginVertical: 2 },
  metricSub: { color: lightColors.textMuted, fontSize: 11 },

  sectionHeading: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },

  powerRow: { flexDirection: 'row', gap: spacing.sm },
  powerCard: {
    flex: 1,
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
  },
  powerLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '700' },
  powerValue: { color: lightColors.text, fontSize: fontSize.xl, fontWeight: '800', marginTop: 2 },
  powerSub: { color: lightColors.textMuted, fontSize: fontSize.sm },
  catBadge: { alignSelf: 'flex-start', backgroundColor: lightColors.background, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.sm },
  catBadgeText: { color: lightColors.primary, fontSize: 11, fontWeight: '700' },

  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  cardLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.sm },

  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  toggle: { flex: 1, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: lightColors.border, alignItems: 'center' },
  toggleActive: { backgroundColor: lightColors.primary, borderColor: lightColors.primary },
  toggleText: { color: lightColors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  toggleTextActive: { color: '#fff' },

  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  coachAvatar: { fontSize: 24 },
  coachTitle: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '700' },
  coachText: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22 },
  coachWarning: { color: lightColors.fatigue, fontSize: fontSize.sm, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: { backgroundColor: lightColors.background, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: lightColors.border },
  chipText: { color: lightColors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  coachButton: { backgroundColor: lightColors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md },
  coachButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },

  prSortRow: { flexDirection: 'row', gap: spacing.sm },
  sortChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: lightColors.border },
  sortChipActive: { backgroundColor: lightColors.text, borderColor: lightColors.text },
  sortChipText: { color: lightColors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  sortChipTextActive: { color: '#fff' },
  prScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  prCard: {
    width: 110,
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
  },
  medal: { fontSize: 14, position: 'absolute', top: spacing.sm, right: spacing.sm },
  prValue: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '800' },
  prLabel: { color: lightColors.textMuted, fontSize: fontSize.sm, marginTop: 2 },

  ctaBlock: { marginTop: spacing.md, gap: spacing.sm },
  primaryButton: { backgroundColor: lightColors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: lightColors.primary, fontSize: fontSize.md, fontWeight: '600' },
});
