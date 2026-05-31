import { useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { useTrainingPlan, type NutritionDay } from '../hooks/useTrainingPlan';
import { Text, Card, Badge, SectionHeader, SkeletonLoader, Emoji } from '../components/ui';
import { spacing, radius } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';

const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

function Row({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.row}>
      <Feather name={icon} size={14} color={colors.primary} style={styles.rowIcon} />
      <View style={styles.flex}>
        <Text variant="caption" color={colors.textTertiary}>
          {label}
        </Text>
        <Text variant="body" color={colors.textPrimary} style={styles.rowValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DayCard({ day }: { day: NutritionDay }) {
  const { colors } = useThemeColors();
  const isToday = day.day === todayWeekday;
  return (
    <Card variant={isToday ? 'raised' : 'default'} style={[styles.dayCard, isToday && { borderColor: colors.primary, borderWidth: 1.5 }]}>
      <View style={styles.dayHead}>
        <Text variant="body" style={styles.bold}>
          {day.day}
        </Text>
        {isToday ? <Badge label="Today" color="emerald" /> : null}
      </View>
      {day.pre_ride ? <Row icon="sunrise" label="Before" value={day.pre_ride} /> : null}
      {day.during_ride ? <Row icon="zap" label="During" value={day.during_ride} /> : null}
      {day.post_ride ? <Row icon="refresh-ccw" label="After" value={day.post_ride} /> : null}
      {day.note ? (
        <Text variant="caption" color={colors.textSecondary} style={styles.note}>
          {day.note}
        </Text>
      ) : null}
    </Card>
  );
}

export default function NutritionScreen() {
  const { colors } = useThemeColors();
  const { plan, loading, refresh } = useTrainingPlan();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const nutrition = plan?.plan_json?.nutrition;
  const days = nutrition?.daily ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.textSecondary} />}
      >
        <View>
          <Text variant="heading2" color={colors.textPrimary}>
            Fuel
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            Your fueling guide for the week — built around your training load.
          </Text>
        </View>

        {loading ? (
          <>
            <SkeletonLoader height={64} borderRadius={radius.lg} />
            <SkeletonLoader height={120} borderRadius={radius.lg} />
            <SkeletonLoader height={120} borderRadius={radius.lg} />
          </>
        ) : days.length === 0 ? (
          <Card variant="tinted" style={styles.empty}>
            <Emoji size={28}>🥗</Emoji>
            <Text variant="bodyLarge" style={styles.bold}>
              No fueling guide yet
            </Text>
            <Text variant="caption" color={colors.textSecondary} style={styles.emptyText}>
              Generate this week's plan and your nutrition guide is built alongside it.
            </Text>
          </Card>
        ) : (
          <>
            {nutrition?.week_focus ? (
              <Card variant="tinted">
                <Text variant="body" color={colors.textPrimary} style={styles.focus}>
                  {nutrition.week_focus}
                </Text>
              </Card>
            ) : null}

            <View style={styles.section}>
              <SectionHeader title="THIS WEEK" />
              <View style={styles.list}>
                {days.map((d, i) => (
                  <DayCard key={`${d.day}-${i}`} day={d} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[12], gap: spacing[4] },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  focus: { lineHeight: 22 },
  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing[4] },
  section: { gap: 0 },
  list: { gap: spacing[2] },
  dayCard: { gap: spacing[3] },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  rowIcon: { marginTop: 3 },
  rowValue: { lineHeight: 20 },
  note: { lineHeight: 18, fontStyle: 'italic' },
});
