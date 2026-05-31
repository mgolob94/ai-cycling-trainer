import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Dimensions, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useFtp } from '../../hooks/useFtp';
import { useProfile } from '../../hooks/useProfile';
import { useWeeklyMetrics } from '../../hooks/useWeeklyMetrics';
import { api, type ApiResponse } from '../../services/api';
import { getWkgRange } from '../../services/metricContext';
import { Text } from '../../components/ui';
import { spacing, radius, palette } from '../../theme/tokens';
import { DARK_TOKENS } from '../../theme/useTheme';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'FirstSyncReveal'>;
const c = DARK_TOKENS; // always-dark reveal
const W = Dimensions.get('window').width;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface RideRow {
  distance_km: number | null;
  elevation_m: number | null;
  tss: number | null;
  ride_date: string | null;
}

// Count from 0 → value over 800ms (easeOutQuart).
function CountUp({ value, style }: { value: number; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setN(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 800, easing: Easing.out(Easing.poly(4)), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);
  return (
    <Text variant="stat" color="#FFFFFF" style={style}>
      {n.toLocaleString('en-US')}
    </Text>
  );
}

export default function FirstSyncRevealScreen({ navigation }: Props) {
  const ftp = useFtp();
  const profile = useProfile();
  const { weeks } = useWeeklyMetrics();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    api
      .get<ApiResponse<RideRow[]>>('/rides', { params: { limit: 365 } })
      .then(({ data }) => setRides(data.data ?? []))
      .catch(() => {});
  }, []);

  const ftpWatts = ftp.ftp?.ftp_watts ?? 0;
  const weight = profile.profile?.weight_kg ?? 0;
  const wkg = ftp.ftp?.watts_per_kg ?? (ftpWatts && weight ? ftpWatts / weight : 0);
  const category = wkg ? getWkgRange(wkg)?.label ?? 'Cyclist' : 'Cyclist';
  const hasPower = !!ftp.ftp?.ftp_watts;

  // Aggregate the last 12 months.
  const now = new Date();
  const buckets: { key: string; label: string; tss: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], tss: 0 });
  }
  let totalKm = 0;
  let totalElev = 0;
  for (const r of rides) {
    totalKm += r.distance_km ?? 0;
    totalElev += r.elevation_m ?? 0;
    if (!r.ride_date) continue;
    const d = new Date(`${r.ride_date}T00:00:00`);
    const b = buckets.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (b) b.tss += r.tss ?? 0;
  }
  const maxMonthTss = Math.max(1, ...buckets.map((b) => b.tss));
  const bestMonth = buckets.reduce((a, b) => (b.tss > a.tss ? b : a), buckets[0]);

  const latest = weeks.length ? weeks[weeks.length - 1] : null;
  const ctl = Math.round(latest?.ctl ?? 0);
  const atl = Math.round(latest?.atl ?? 0);
  const tsb = Math.round(latest?.tsb ?? 0);
  const formWord = tsb > 10 ? 'Fresh.' : tsb >= -10 ? 'Good shape.' : 'Tired.';
  const formLine =
    tsb > 10
      ? "You're rested and ready. A great moment to start a structured plan."
      : tsb >= -10
        ? 'Your fitness has been building steadily. This is the best time to start a structured plan.'
        : "You've been training hard recently. We'll build in the right recovery from day one.";

  const onPage = (e: { nativeEvent: { contentOffset: { x: number } } }) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  const finish = () => navigation.navigate('TrainingPlan');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <Pressable style={styles.skip} onPress={finish} hitSlop={8}>
        <Text variant="caption" color="#525250">
          Skip to my plan
        </Text>
      </Pressable>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onPage}>
        {/* CARD 1 — Your engine */}
        <View style={styles.card}>
          <Text variant="label" color={c.green}>
            {hasPower ? `BASED ON YOUR ${rides.length} RIDES` : 'ESTIMATED FROM HEART RATE DATA'}
          </Text>
          <View style={styles.engineRow}>
            <CountUp value={ftpWatts} style={styles.ftp} />
            <Text variant="heading2" color="#FFFFFF" style={styles.ftpUnit}>
              W
            </Text>
          </View>
          <Text variant="heading3" color={c.green}>
            {wkg ? `${wkg.toFixed(1)} W/kg · ${category}` : category}
          </Text>
          <Text variant="body" color="#787876" style={styles.context}>
            That puts you ahead of roughly 70% of recreational cyclists.
          </Text>
        </View>

        {/* CARD 2 — Your season so far */}
        <View style={styles.card}>
          <Text variant="label" color={c.green}>
            YOUR SEASON SO FAR
          </Text>
          <View style={styles.chart}>
            {buckets.map((b) => {
              const isBest = b.key === bestMonth.key && b.tss > 0;
              return (
                <View key={b.key} style={styles.barCol}>
                  <View
                    style={[
                      styles.bar,
                      { height: Math.max(2, (b.tss / maxMonthTss) * 120), backgroundColor: isBest ? palette.amber400 : c.green },
                    ]}
                  />
                  <Text variant="caption" color="#525250" style={styles.barLabel}>
                    {b.label[0]}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.bubbles}>
            <Bubble value={`${Math.round(totalKm).toLocaleString('en-US')}`} unit="km" />
            <Bubble value={`${Math.round(totalElev).toLocaleString('en-US')}`} unit="m climbed" />
            <Bubble value={`${rides.length}`} unit="rides" />
          </View>
          {bestMonth.tss > 0 ? (
            <Text variant="caption" color={palette.amber400} style={styles.bold}>
              Your best month: {bestMonth.label} — {Math.round(bestMonth.tss)} TSS
            </Text>
          ) : null}
          <Text variant="body" color="#787876" style={styles.context}>
            You&apos;ve been consistent. That&apos;s the hardest part — and you&apos;ve already done it.
          </Text>
        </View>

        {/* CARD 3 — Your current fitness */}
        <View style={styles.card}>
          <Text variant="label" color={c.green}>
            YOUR CURRENT FITNESS
          </Text>
          <Text variant="stat" color="#FFFFFF" style={styles.formWord}>
            {formWord}
          </Text>
          <Text variant="body" color="#787876" style={styles.context}>
            {formLine}
          </Text>
          <Text variant="caption" color="#525250" style={styles.smallNums}>
            Fitness: {ctl}   Fatigue: {atl}   Form: {tsb >= 0 ? '+' : ''}
            {tsb}
          </Text>
          <Pressable style={styles.cta} onPress={finish}>
            <Text variant="body" color="#111110" style={styles.ctaText}>
              Build my first plan →
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? c.green : '#333331' }]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

function Bubble({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.bubble}>
      <Text variant="statMd" color="#FFFFFF">
        {value}
      </Text>
      <Text variant="label" color="#525250">
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  skip: { position: 'absolute', top: spacing[10], right: spacing[5], zIndex: 10 },
  card: { width: W, paddingHorizontal: spacing[6], justifyContent: 'center', gap: spacing[3] },
  engineRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing[2] },
  ftp: { fontSize: 72, lineHeight: 76 },
  ftpUnit: { marginTop: spacing[2] },
  context: { lineHeight: 22, marginTop: spacing[1] },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, marginTop: spacing[4] },
  barCol: { flex: 1, alignItems: 'center', gap: spacing[1] },
  bar: { width: '60%', borderRadius: radius.xs },
  barLabel: { fontSize: 9 },
  bubbles: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[4] },
  bubble: { alignItems: 'center', gap: 2 },
  formWord: { fontSize: 48, lineHeight: 52, marginTop: spacing[2] },
  smallNums: { marginTop: spacing[2] },
  cta: { backgroundColor: '#FFFFFF', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing[6] },
  ctaText: { fontWeight: '700' },
  bold: { fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
