import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, apiOrigin, ApiResponse } from '../services/api';
import { lightColors, spacing, radius, fontSize } from '../theme';

interface TrendReport {
  trend: 'improving' | 'plateauing' | 'declining';
  explanation: string;
  recommendations: string[];
}

const TREND_META: Record<string, { label: string; color: string; icon: string }> = {
  improving: { label: 'Improving', color: lightColors.form, icon: '📈' },
  plateauing: { label: 'Stable', color: '#F5A623', icon: '➡️' },
  declining: { label: 'Declining', color: lightColors.fatigue, icon: '📉' },
};

export default function AIReportScreen() {
  const [report, setReport] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<TrendReport>>(`${apiOrigin}/ai/trend`);
        setReport(data.data ?? null);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Could not load the analysis.');
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const meta = report ? TREND_META[report.trend] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={lightColors.primary} />
            <Text style={styles.muted}>Preparing your full analysis…</Text>
          </View>
        ) : error || !report ? (
          <Text style={styles.error}>{error ?? 'No data to analyze.'}</Text>
        ) : (
          <>
            <View style={[styles.card, { borderLeftWidth: 5, borderLeftColor: meta?.color }]}>
              <Text style={styles.trendLabel}>
                {meta?.icon} 12-week trend: {meta?.label}
              </Text>
              <Text style={styles.explanation}>{report.explanation}</Text>
            </View>

            {report.recommendations.length ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>COACH'S RECOMMENDATIONS</Text>
                {report.recommendations.map((r, i) => (
                  <View key={i} style={styles.recRow}>
                    <Text style={styles.recBullet}>{i + 1}</Text>
                    <Text style={styles.recText}>{r}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  muted: { color: lightColors.textMuted, fontSize: fontSize.sm },
  error: { color: lightColors.fatigue, fontSize: fontSize.md, textAlign: 'center', padding: spacing.lg },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  cardLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.sm },
  trendLabel: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '800' },
  explanation: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
  recRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, alignItems: 'flex-start' },
  recBullet: {
    color: '#fff',
    backgroundColor: lightColors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '800',
    fontSize: fontSize.sm,
    overflow: 'hidden',
  },
  recText: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22, flex: 1 },
});
