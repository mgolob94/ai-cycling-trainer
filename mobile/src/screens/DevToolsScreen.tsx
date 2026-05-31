import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';

import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { DataSource } from '../services/dataSource';
import { getLogs, LOG_TAGS } from '../services/logBuffer';
import { Text, Card, Button, SectionHeader } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const SCREENS: (keyof AppStackParamList)[] = [
  'Dashboard',
  'Progress',
  'Recovery',
  'Rides',
  'Profile',
  'TrainingPlan',
  'StravaConnect',
  'Periodization',
  'AIReport',
  'FTPTestWizard',
];

const SOURCES = [
  { key: 'apple_health', label: 'Apple Health' },
  { key: 'garmin', label: 'Garmin' },
  { key: 'whoop', label: 'Whoop' },
  { key: 'strava', label: 'Strava' },
];

export default function DevToolsScreen() {
  if (!__DEV__) return null;
  return <DevTools />;
}

function DevTools() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.userId);

  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLogs(getLogs(logFilter));
    if (userId) {
      const { data } = await supabase.from('source_connections').select('source, is_connected').eq('user_id', userId);
      const map: Record<string, boolean> = {};
      for (const r of data ?? []) map[r.source] = !!r.is_connected;
      setConnected(map);
    }
  }, [logFilter, userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const today = new Date().toISOString().slice(0, 10);

  const simulateBadRecovery = async () => {
    if (!userId) return Alert.alert('Sign in first');
    await supabase.from('recovery_scores').upsert(
      { user_id: userId, date: today, recovery_score: 25, hrv_score: 20, sleep_score: 30, training_load_score: 30, readiness_label: 'rest', recommendation: 'Your body needs rest. No training today.' },
      { onConflict: 'user_id,date' }
    );
    Alert.alert('Done', "Today's recovery set to 25 (rest).");
  };

  const simulateNewPR = async () => {
    if (!userId) return Alert.alert('Sign in first');
    await supabase.from('personal_records').insert({ user_id: userId, record_type: 'best_5min_power', value: 320, unit: 'watts', achieved_date: today });
    Alert.alert('Done', 'Added a fake 5-min power PR (320W).');
  };

  const clearCache = async () => {
    try {
      await api.delete('/cache/invalidate', { data: { all: true } });
      Alert.alert('AI cache cleared');
    } catch {
      Alert.alert('Failed to clear cache');
    }
  };
  const cacheStats = async () => {
    try {
      const { data } = await api.get('/cache/stats');
      Alert.alert('Cache stats', JSON.stringify(data.data, null, 2));
    } catch {
      Alert.alert('Failed to load cache stats');
    }
  };
  const triggerRecovery = async () => {
    try {
      const { data } = await api.post('/recovery/calculate');
      Alert.alert('Recovery calculated', `Score: ${data.data?.recovery_score} (${data.data?.readiness_label})`);
    } catch {
      Alert.alert('Failed to calculate recovery');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="heading2" color={colors.textPrimary}>
          Dev Tools
        </Text>

        {/* Data source */}
        <Card variant="default" style={styles.card}>
          <SectionHeader title="DATA SOURCE" />
          <Text variant="body" color={colors.textPrimary}>
            Using: {DataSource.isMockMode() ? 'Mock data' : 'Real data'}
          </Text>
          <Button label="Re-seed mock data" variant="secondary" size="sm" onPress={() => Alert.alert('Re-seed', 'Run `npm --prefix backend run seed` to re-seed Supabase.')} />
        </Card>

        {/* Mock controls */}
        <Card variant="default" style={styles.card}>
          <SectionHeader title="MOCK DATA CONTROLS" />
          <Button label="Simulate bad recovery day" variant="secondary" size="sm" onPress={simulateBadRecovery} />
          <Button label="Simulate new PR" variant="secondary" size="sm" onPress={simulateNewPR} />
          <Button label="Simulate new Strava activity" variant="secondary" size="sm" onPress={() => Alert.alert('Not wired', 'Webhook simulation runs from the backend.')} />
          <Button label="Fast-forward week" variant="secondary" size="sm" onPress={() => Alert.alert('Not wired', 'Date shifting is not implemented yet.')} />
        </Card>

        {/* API status */}
        <Card variant="default" style={styles.card}>
          <SectionHeader title="API STATUS" />
          {SOURCES.map((s) => (
            <View key={s.key} style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: connected[s.key] ? palette.emerald400 : colors.border }]} />
              <Text variant="caption" color={colors.textPrimary}>
                {s.label} — {connected[s.key] ? 'connected' : 'not connected'}
              </Text>
            </View>
          ))}
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: palette.emerald400 }]} />
            <Text variant="caption" color={colors.textPrimary}>
              Supabase — {String(Constants.expoConfig?.extra?.supabaseUrl ?? '').replace('https://', '')}
            </Text>
          </View>
        </Card>

        {/* Cache */}
        <Card variant="default" style={styles.card}>
          <SectionHeader title="CACHE" />
          <Button label="Clear all AI cache" variant="secondary" size="sm" onPress={clearCache} />
          <Button label="View cache stats" variant="secondary" size="sm" onPress={cacheStats} />
          <Button label="Trigger recovery score calc" variant="secondary" size="sm" onPress={triggerRecovery} />
        </Card>

        {/* Navigation shortcuts */}
        <Card variant="default" style={styles.card}>
          <SectionHeader title="NAVIGATION" />
          <View style={styles.navGrid}>
            {SCREENS.map((screen) => (
              <Pressable key={screen} style={[styles.navChip, { borderColor: colors.border }]} onPress={() => navigation.navigate(screen as never)}>
                <Text variant="caption" color={palette.indigo600}>
                  {screen}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Logs */}
        <Card variant="default" style={styles.card}>
          <View style={styles.logHead}>
            <SectionHeader title="LOGS" />
            <Pressable onPress={refresh} hitSlop={8}>
              <Text variant="caption" color={palette.indigo600}>
                Refresh
              </Text>
            </Pressable>
          </View>
          <View style={styles.filterRow}>
            {[null, ...LOG_TAGS].map((tag) => (
              <Pressable
                key={tag ?? 'all'}
                style={[styles.filterChip, logFilter === tag && { backgroundColor: colors.textPrimary }]}
                onPress={() => setLogFilter(tag)}
              >
                <Text variant="caption" color={logFilter === tag ? colors.background : colors.textSecondary}>
                  {tag ?? 'All'}
                </Text>
              </Pressable>
            ))}
          </View>
          {logs.length === 0 ? (
            <Text variant="caption" color={colors.textTertiary}>
              No logs captured.
            </Text>
          ) : (
            logs.map((l, i) => (
              <Text key={i} variant="caption" color={colors.textSecondary} style={styles.logLine}>
                {l}
              </Text>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  card: { gap: spacing[2] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 2 },
  dot: { width: 9, height: 9, borderRadius: radius.full },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  navChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginBottom: spacing[2] },
  filterChip: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  logLine: { fontSize: 10, lineHeight: 14 },
});
