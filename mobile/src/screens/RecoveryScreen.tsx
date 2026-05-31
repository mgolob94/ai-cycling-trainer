import { useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { useRecovery, type SleepSession } from '../hooks/useRecovery';
import { useAuthStore } from '../store/useAuthStore';
import * as appleHealth from '../services/appleHealth';
import { hasSeenRecoverySetup } from '../services/recoverySetup';
import type { AppStackParamList } from '../navigation/types';
import { Text, Card, SectionHeader, SkeletonLoader, Emoji } from '../components/ui';
import CircularProgress from '../components/CircularProgress';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

function scoreColor(s: number): string {
  if (s >= 85) return palette.emerald400;
  if (s >= 70) return palette.indigo400;
  if (s >= 50) return palette.amber400;
  if (s >= 30) return palette.rose400;
  return palette.rose600;
}

const READINESS_LABEL: Record<string, string> = {
  optimal: 'Peak readiness',
  good: 'Good readiness',
  moderate: 'Moderate readiness',
  poor: 'Low readiness',
  rest: 'Rest day',
};

const SOURCE_LABEL: Record<string, string> = {
  apple_health: 'Apple Health',
  garmin: 'Garmin',
  whoop: 'Whoop',
};

function fmtDuration(min: number | null): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function relTime(iso: string | null): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function sleepQuality(s: SleepSession | null): string {
  if (!s || !s.duration_min) return '—';
  if (s.sleep_score != null) return s.sleep_score >= 80 ? 'Great' : s.sleep_score >= 60 ? 'Good' : 'Fair';
  const frac = ((s.deep_min ?? 0) + (s.rem_min ?? 0)) / s.duration_min;
  return frac >= 0.4 ? 'Great' : frac >= 0.25 ? 'Good' : 'Fair';
}

const STAGE_COLORS = { deep: '#1E40AF', rem: palette.indigo400, light: palette.sky400, awake: palette.rose400 };

function ContributionBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.contribRow}>
      <Text variant="label" color={palette.slate400} style={styles.contribLabel}>
        {label}
      </Text>
      <View style={styles.contribTrack}>
        <View style={[styles.contribFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: scoreColor(value) }]} />
      </View>
      <Text variant="statSm" color="#FFFFFF" style={styles.contribValue}>
        {Math.round(value)}
      </Text>
    </View>
  );
}

export default function RecoveryScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const userId = useAuthStore((s) => s.userId);
  const { score, adaptation, hrv, hrvBaseline, lastSleep, sources, loading, refresh } = useRecovery();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // First visit → one-time setup (data sources / manual fallback).
  const setupChecked = useRef(false);
  useEffect(() => {
    if (setupChecked.current) return;
    setupChecked.current = true;
    hasSeenRecoverySetup().then((seen) => {
      if (!seen) navigation.navigate('RecoverySetup');
    });
  }, [navigation]);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const connectApple = async () => {
    if (!userId) return;
    const r = await appleHealth.syncToDatabase(userId);
    if (!r.available) {
      Alert.alert('Apple Health unavailable', 'Apple Health needs an iOS device with a development build.');
      return;
    }
    Alert.alert('Synced', `HRV: ${r.hrv_synced} · Sleep: ${r.sleep_synced}`);
    refresh();
  };

  const connectSource = (src: string) => {
    if (src === 'apple_health') return connectApple();
    Alert.alert(SOURCE_LABEL[src] ?? src, 'Coming soon.');
  };

  // HRV trend.
  const hrvMax = Math.max(1, ...hrv.map((p) => p.hrv_ms), hrvBaseline ?? 0);
  const todayHrv = hrv.length ? hrv[hrv.length - 1].hrv_ms : null;
  const hrvTrend =
    todayHrv != null && hrvBaseline
      ? todayHrv > hrvBaseline * 1.02
        ? { text: 'Rising trend — good!', color: palette.emerald600 }
        : todayHrv < hrvBaseline * 0.98
          ? { text: 'Declining trend', color: palette.amber600 }
          : { text: 'Stable trend', color: colors.textSecondary }
      : null;

  // Known sources, merged with stored connection state.
  const sourceState = ['apple_health', 'garmin', 'whoop'].map((src) => {
    const conn = sources.find((s) => s.source === src);
    return { source: src, is_connected: conn?.is_connected ?? false, last_sync_at: conn?.last_sync_at ?? null };
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.slate400} />}
      >
        {/* Header */}
        <View>
          <Text variant="heading2" color={colors.textPrimary}>
            Recovery
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {today}
          </Text>
        </View>

        {/* Recovery score hero */}
        {loading && !score ? (
          <SkeletonLoader height={320} borderRadius={radius.lg} />
        ) : score ? (
          <Card variant="dark" padding={20}>
            <View style={styles.dialWrap}>
              <CircularProgress
                percent={score.recovery_score}
                size={180}
                strokeWidth={16}
                color={scoreColor(score.recovery_score)}
                trackColor="rgba(255,255,255,0.12)"
                label={String(score.recovery_score)}
                caption={READINESS_LABEL[score.readiness_label] ?? score.readiness_label}
                labelColor="#FFFFFF"
                captionColor={palette.slate200}
              />
            </View>
            <Text variant="bodyLarge" color="rgba(255,255,255,0.8)" style={styles.recommendation}>
              {score.recommendation}
            </Text>
            <View style={styles.contribList}>
              <ContributionBar label="HRV" value={score.hrv_score} />
              <ContributionBar label="Sleep" value={score.sleep_score} />
              <ContributionBar label="Training" value={score.training_load_score} />
            </View>
          </Card>
        ) : (
          <Card variant="tinted">
            <Text variant="body" color={colors.textPrimary}>
              No recovery data yet
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Connect a data source below to start tracking recovery.
            </Text>
          </Card>
        )}

        {/* Training adaptation */}
        {adaptation ? (
          <Card variant="default" style={[styles.adaptCard, { borderColor: palette.amber400, backgroundColor: palette.amber50 }]}>
            <View style={styles.adaptHead}>
              <Text variant="label" color={palette.amber600}>
                WORKOUT ADAPTED FOR RECOVERY
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert(
                    'Why adapted?',
                    adaptation.adapted.adaptation?.note ?? adaptation.warning?.message ?? 'Adjusted to your recovery.'
                  )
                }
              >
                <Feather name="info" size={14} color={palette.amber600} />
              </Pressable>
            </View>
            <View style={styles.adaptRow}>
              <Text variant="caption" color={palette.slate600} style={styles.strike}>
                {adaptation.original.type} · {adaptation.original.duration_min ?? '—'} min · {adaptation.original.intensity}
              </Text>
              <Feather name="arrow-right" size={14} color={palette.slate600} />
              <Text variant="body" color={palette.slate900} style={styles.bold}>
                {adaptation.adapted.type} · {adaptation.adapted.duration_min ?? '—'} min · {adaptation.adapted.intensity}
              </Text>
            </View>
            {adaptation.warning ? (
              <Text variant="caption" color={palette.rose600} style={styles.warnText}>
                ⚠ {adaptation.warning.message}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* HRV trend */}
        {hrv.length ? (
          <Card variant="default">
            <SectionHeader title="HRV TREND" />
            <View style={styles.sparkline}>
              {hrvBaseline ? (
                <View
                  style={[styles.baseline, { bottom: (hrvBaseline / hrvMax) * 72, borderColor: colors.border }]}
                  pointerEvents="none"
                />
              ) : null}
              {hrv.map((p, i) => {
                const isToday = i === hrv.length - 1;
                return (
                  <View
                    key={p.recorded_at}
                    style={[
                      styles.sparkBar,
                      {
                        height: Math.max(3, (p.hrv_ms / hrvMax) * 72),
                        backgroundColor: isToday ? palette.emerald400 : palette.slate200,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.hrvFooter}>
              {hrvTrend ? (
                <Text variant="caption" color={hrvTrend.color} style={styles.bold}>
                  {hrvTrend.text}
                </Text>
              ) : null}
              {hrvBaseline ? (
                <Text variant="caption" color={colors.textSecondary}>
                  Baseline {hrvBaseline} ms{todayHrv != null ? ` · today ${Math.round(todayHrv)} ms` : ''}
                </Text>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Sleep */}
        {lastSleep ? (
          <Card variant="default">
            <SectionHeader title="SLEEP" />
            <View style={styles.sleepHead}>
              <Text variant="stat" color={colors.textPrimary}>
                {fmtDuration(lastSleep.duration_min)}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {sleepQuality(lastSleep)}
                {lastSleep.sleep_score != null ? ` · score ${lastSleep.sleep_score}` : ''}
              </Text>
            </View>
            <View style={styles.stageBar}>
              {(['deep', 'rem', 'light', 'awake'] as const).map((stage) => {
                const min = lastSleep[`${stage}_min` as keyof SleepSession] as number | null;
                if (!min) return null;
                return <View key={stage} style={{ flex: min, backgroundColor: STAGE_COLORS[stage] }} />;
              })}
            </View>
            <View style={styles.stageLabels}>
              {(['deep', 'rem', 'light', 'awake'] as const).map((stage) => (
                <View key={stage} style={styles.stageLabel}>
                  <View style={[styles.stageDot, { backgroundColor: STAGE_COLORS[stage] }]} />
                  <Text variant="caption" color={colors.textSecondary}>
                    {stage[0].toUpperCase() + stage.slice(1)} {Math.round((lastSleep[`${stage}_min` as keyof SleepSession] as number) ?? 0)}m
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Data sources */}
        <Card variant="default">
          <SectionHeader title="DATA SOURCES" />
          {sourceState.map((s, i) => (
            <View key={s.source} style={[styles.sourceRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}>
              <View style={[styles.sourceDot, { backgroundColor: s.is_connected ? palette.emerald400 : colors.border }]} />
              <View style={styles.flex}>
                <Text variant="body" color={colors.textPrimary}>
                  {SOURCE_LABEL[s.source]}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {s.is_connected ? `Synced ${relTime(s.last_sync_at)}` : 'Not connected'}
                </Text>
              </View>
              {!s.is_connected ? (
                <Pressable hitSlop={8} onPress={() => connectSource(s.source)}>
                  <Text variant="caption" color={colors.accent} style={styles.bold}>
                    Connect →
                  </Text>
                </Pressable>
              ) : (
                <Feather name="check" size={16} color={palette.emerald600} />
              )}
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },

  dialWrap: { alignItems: 'center', marginBottom: spacing[3] },
  recommendation: { lineHeight: 24, textAlign: 'center' },
  contribList: { gap: spacing[2], marginTop: spacing[4] },
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  contribLabel: { width: 64 },
  contribTrack: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  contribFill: { height: 8, borderRadius: radius.full },
  contribValue: { width: 32, textAlign: 'right' },

  adaptCard: { borderWidth: 1, gap: spacing[3] },
  adaptHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adaptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  strike: { textDecorationLine: 'line-through' },
  warnText: { marginTop: spacing[1] },

  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80, marginTop: spacing[2], position: 'relative' },
  baseline: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  sparkBar: { flex: 1, borderRadius: 2 },
  hrvFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[3] },

  sleepHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginVertical: spacing[2] },
  stageBar: { flexDirection: 'row', height: 14, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing[2] },
  stageLabels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[3] },
  stageLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  stageDot: { width: 8, height: 8, borderRadius: radius.full },

  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  sourceDot: { width: 9, height: 9, borderRadius: radius.full },
});
