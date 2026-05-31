import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Text } from '../components/ui';
import { spacing, radius } from '../theme/tokens';
import { DARK_TOKENS } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

export interface MonthRevealData {
  month_number: number;
  fitness: { week1_ctl: number; now_ctl: number; delta: number; note: string };
  consistency: { rides: number; planned_pct: number | null; prev_rides: number };
  best_ride: { title: string; date: string | null; stat: string } | null;
  coach_message: string;
}

type Props = NativeStackScreenProps<AppStackParamList, 'MonthProgress'>;
const c = DARK_TOKENS;
const W = Dimensions.get('window').width;

export default function MonthProgressScreen({ route, navigation }: Props) {
  const d = route.params.data;
  const [page, setPage] = useState(0);
  const onPage = (e: { nativeEvent: { contentOffset: { x: number } } }) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text variant="label" color={c.green}>
          {d.month_number * 4} WEEKS IN
        </Text>
        <Text variant="stat" color="#FFFFFF" style={styles.title}>
          Here&apos;s what changed.
        </Text>
      </View>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onPage}>
        {/* CARD 1 — Fitness */}
        <View style={styles.card}>
          <Text variant="label" color={c.textDim}>
            FITNESS
          </Text>
          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text variant="label" color={c.textDim}>
                WEEK 1
              </Text>
              <Text variant="stat" color={c.textSecondary} style={styles.compareVal}>
                {d.fitness.week1_ctl}
              </Text>
            </View>
            <Text variant="heading2" color={c.textDim}>
              →
            </Text>
            <View style={styles.compareCol}>
              <Text variant="label" color={c.textDim}>
                NOW
              </Text>
              <Text variant="stat" color="#FFFFFF" style={styles.compareVal}>
                {d.fitness.now_ctl}
              </Text>
            </View>
          </View>
          {d.fitness.delta !== 0 ? (
            <Text variant="heading3" color={c.green}>
              {d.fitness.delta > 0 ? '+' : ''}
              {d.fitness.delta} points
            </Text>
          ) : null}
          <Text variant="body" color="#787876" style={styles.note}>
            {d.fitness.note}
          </Text>
        </View>

        {/* CARD 2 — Consistency */}
        <View style={styles.card}>
          <Text variant="label" color={c.textDim}>
            CONSISTENCY
          </Text>
          <Text variant="body" color="#787876">
            You rode
          </Text>
          <Text variant="stat" color="#FFFFFF" style={styles.bigNum}>
            {d.consistency.rides}
          </Text>
          <Text variant="body" color="#787876">
            times in 4 weeks.
          </Text>
          {d.consistency.planned_pct != null ? (
            <>
              <View style={[styles.pctTrack, { backgroundColor: c.surfaceRaised }]}>
                <View style={[styles.pctFill, { width: `${Math.min(100, d.consistency.planned_pct)}%`, backgroundColor: c.green }]} />
              </View>
              <Text variant="caption" color={c.textSecondary}>
                {d.consistency.planned_pct}% of your planned workouts completed
              </Text>
            </>
          ) : null}
          {d.consistency.prev_rides > 0 ? (
            <Text variant="caption" color={c.textDim} style={styles.note}>
              vs. {d.consistency.prev_rides} rides the 4 weeks before
            </Text>
          ) : null}
        </View>

        {/* CARD 3 — Best moment */}
        <View style={styles.card}>
          <Text variant="label" color={c.textDim}>
            YOUR BEST RIDE THIS MONTH
          </Text>
          {d.best_ride ? (
            <>
              <Text variant="heading2" color="#FFFFFF" style={styles.note}>
                {d.best_ride.title}
              </Text>
              <Text variant="statMd" color={c.green}>
                {d.best_ride.stat}
              </Text>
            </>
          ) : (
            <Text variant="body" color="#787876">
              More rides next month means more highlights here.
            </Text>
          )}
          <Text variant="body" color="#787876" style={styles.coach}>
            {d.coach_message}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? c.green : '#333331' }]} />
        ))}
      </View>

      <Pressable style={styles.cta} onPress={() => navigation.goBack()}>
        <Text variant="body" color="#111110" style={styles.ctaText}>
          Keep going →
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[1] },
  title: { fontSize: 36, lineHeight: 40 },
  card: { width: W, paddingHorizontal: spacing[6], justifyContent: 'center', gap: spacing[3], flex: 1 },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  compareCol: { alignItems: 'center', gap: spacing[1] },
  compareVal: { fontSize: 56, lineHeight: 60 },
  note: { lineHeight: 22 },
  bigNum: { fontSize: 64, lineHeight: 68 },
  pctTrack: { height: 6, borderRadius: radius.full, overflow: 'hidden', marginTop: spacing[2] },
  pctFill: { height: '100%', borderRadius: radius.full },
  coach: { lineHeight: 22, marginTop: spacing[4] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  cta: { backgroundColor: '#FFFFFF', borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginHorizontal: spacing[6], marginBottom: spacing[4] },
  ctaText: { fontWeight: '700' },
});
