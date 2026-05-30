import { useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useWeeklyMetrics } from '../hooks/useWeeklyMetrics';
import { useFtp } from '../hooks/useFtp';
import { useProfile } from '../hooks/useProfile';
import { Text, Button, Badge } from '../components/ui';
import TrainingScaleBar, { type ScaleZone } from '../components/metrics/TrainingScaleBar';
import { interpretTSB, interpretFTP } from '../services/metricsInterpreter';
import { markMetricsIntroSeen } from '../services/metricsIntro';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const TSB_ZONES: ScaleZone[] = [
  { from: -40, to: -20, label: 'Overreached', color: palette.rose400 },
  { from: -20, to: -5, label: 'Tired', color: palette.amber400 },
  { from: -5, to: 12, label: 'Optimal', color: palette.indigo400 },
  { from: 12, to: 25, label: 'Fresh', color: palette.emerald400 },
  { from: 25, to: 40, label: 'Very fresh', color: palette.emerald600 },
];

export default function MetricsIntroScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { weeks } = useWeeklyMetrics();
  const ftp = useFtp();
  const profile = useProfile();

  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const latest = weeks.length ? weeks[weeks.length - 1] : null;
  const tsb = latest?.tsb ?? 0;
  const tsbInfo = interpretTSB(tsb);
  const weight = profile.profile?.weight_kg ?? 0;
  const ftpWatts = ftp.ftp?.ftp_watts ?? 0;
  const ftpInfo = interpretFTP(ftpWatts, weight, null);

  const finish = async () => {
    await markMetricsIntroSeen();
    navigation.navigate('Tabs', { screen: 'Dashboard' });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (page < 2) scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    else finish();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Pressable style={styles.skip} onPress={finish} hitSlop={8}>
        <Text variant="caption" color={colors.textTertiary}>
          Skip
        </Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.flex}
      >
        {/* Card 1 — Form */}
        <View style={[styles.card, { width }]}>
          <Text style={styles.emoji}>🎯</Text>
          <Text variant="heading1" color={colors.textPrimary} style={styles.title}>
            Your form today
          </Text>
          <Text variant="bodyLarge" color={colors.textSecondary} style={styles.body}>
            Every day we show you whether you're fresh or fatigued — and what that means for training.
          </Text>
          <View style={styles.visual}>
            <TrainingScaleBar value={tsb} min={-40} max={40} zones={TSB_ZONES} showValue />
            <Text variant="caption" color={colors.textSecondary} style={styles.personal}>
              Your current form: {tsbInfo.label}
            </Text>
          </View>
        </View>

        {/* Card 2 — Fitness vs Fatigue */}
        <View style={[styles.card, { width }]}>
          <Text style={styles.emoji}>📈</Text>
          <Text variant="heading1" color={colors.textPrimary} style={styles.title}>
            Fitness rises slowly, fatigue fast
          </Text>
          <Text variant="bodyLarge" color={colors.textSecondary} style={styles.body}>
            Fitness (CTL) builds over months. Fatigue (ATL) comes and goes in days. Your form is the
            difference between them.
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: palette.indigo400 }]} />
              <Text variant="caption" color={colors.textSecondary}>
                Fitness — slow & steady
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: palette.rose400 }]} />
              <Text variant="caption" color={colors.textSecondary}>
                Fatigue — spikes & recovers
              </Text>
            </View>
          </View>
        </View>

        {/* Card 3 — FTP */}
        <View style={[styles.card, { width }]}>
          <Text style={styles.emoji}>⚡</Text>
          <Text variant="heading1" color={colors.textPrimary} style={styles.title}>
            Your engine — FTP
          </Text>
          <Text variant="bodyLarge" color={colors.textSecondary} style={styles.body}>
            A higher FTP means the same speed with less effort. Every W/kg counts on the climbs.
          </Text>
          <View style={styles.visual}>
            <Text variant="stat" color={colors.textPrimary}>
              {ftpWatts || '—'}
              <Text variant="statSm" color={colors.textSecondary}>
                {' '}W
              </Text>
            </Text>
            {ftpWatts ? (
              <View style={styles.ftpRow}>
                <Badge label={ftpInfo.category} color="indigo" />
                <Text variant="caption" color={colors.textSecondary}>
                  {ftpInfo.wattsPerKg} W/kg
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Dots + CTA */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.pageDot, { backgroundColor: i === page ? colors.textPrimary : colors.border }]}
            />
          ))}
        </View>
        <Button label={page === 2 ? "Got it, let's go!" : 'Next'} variant="primary" size="lg" onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  skip: { position: 'absolute', top: spacing[8], right: spacing[5], zIndex: 1, padding: spacing[2] },
  card: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[4] },
  emoji: { fontSize: 64 },
  title: { lineHeight: 40 },
  body: { lineHeight: 26 },
  visual: { marginTop: spacing[4], gap: spacing[3] },
  personal: { fontWeight: '600' },
  legendRow: { gap: spacing[3], marginTop: spacing[4] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dot: { width: 12, height: 12, borderRadius: radius.full },
  ftpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  footer: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[4] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2] },
  pageDot: { width: 8, height: 8, borderRadius: radius.full },
});
