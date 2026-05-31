import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api, type ApiResponse } from '../services/api';
import type { Ride } from '../hooks/useTrainingPlan';
import { Text, Card, SectionHeader, SkeletonLoader } from '../components/ui';
import { palette, spacing } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { AppStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function RideRow({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  const { colors } = useThemeColors();
  return (
    <Card variant="default" onPress={onPress} style={styles.row}>
      <View style={styles.rowMain}>
        <Text variant="body" color={colors.textPrimary} style={styles.rowTitle}>
          {ride.distance_km != null ? `${ride.distance_km.toFixed(1)} km` : 'Ride'}
        </Text>
        <Text variant="caption">{formatDate(ride.ride_date)}</Text>
      </View>
      <View style={styles.rowStats}>
        <Text variant="statSm" color={colors.textPrimary}>
          {ride.avg_power_w != null ? Math.round(ride.avg_power_w) : '—'}
          <Text variant="caption"> W</Text>
        </Text>
        <Text variant="caption">{formatDuration(ride.duration_sec)}</Text>
      </View>
    </Card>
  );
}

export default function RidesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useThemeColors();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ApiResponse<Ride[]>>('/rides', { params: { limit: 50 } });
      setRides(data.data ?? []);
    } catch {
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.slate400} />}
      >
        <SectionHeader title={`RIDES${rides.length ? ` · ${rides.length}` : ''}`} />
        {loading && !rides.length ? (
          <View style={styles.list}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonLoader key={i} height={64} borderRadius={16} />
            ))}
          </View>
        ) : rides.length === 0 ? (
          <Card variant="tinted">
            <Text variant="body" color={colors.textPrimary}>
              No rides yet
            </Text>
            <Text variant="caption">Your rides will appear here once Strava syncs.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {rides.map((r) => (
              <RideRow
                key={r.id ?? r.strava_id}
                ride={r}
                onPress={() => navigation.navigate('RideDetail', { stravaId: r.strava_id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },
  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowMain: { gap: 2 },
  rowTitle: { fontWeight: '600' },
  rowStats: { alignItems: 'flex-end', gap: 2 },
});
