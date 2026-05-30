import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  isCached: boolean;
  generatedAt?: string | null;
  onRefresh: () => void | Promise<void>;
}

// Fixed chip colors so the badge reads on both light and dark screens.
const GREY_BG = '#E3E8EF';
const GREY_TEXT = '#475569';
const GREEN_BG = '#2E9E5B';

function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Shows whether an AI analysis is cached or freshly generated.
 * - cached: a grey "Saved • <time>" chip with a refresh button.
 * - fresh: a green "Fresh analysis • just now" chip that auto-hides after 5s.
 */
export default function AIAnalysisBadge({ isCached, generatedAt, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [freshVisible, setFreshVisible] = useState(!isCached);

  useEffect(() => {
    if (isCached) {
      setFreshVisible(false);
      return undefined;
    }
    setFreshVisible(true);
    const t = setTimeout(() => setFreshVisible(false), 5000);
    return () => clearTimeout(t);
  }, [isCached, generatedAt]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setRefreshing(false);
    }
  };

  if (isCached) {
    return (
      <View style={[styles.chip, { backgroundColor: GREY_BG }]}>
        <Text style={[styles.text, { color: GREY_TEXT }]}>Saved • {relativeTime(generatedAt)}</Text>
        <TouchableOpacity onPress={handleRefresh} hitSlop={8} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color={GREY_TEXT} />
          ) : (
            <Text style={[styles.icon, { color: GREY_TEXT }]}>↻</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (freshVisible) {
    return (
      <View style={[styles.chip, { backgroundColor: GREEN_BG }]}>
        <Text style={[styles.text, { color: '#fff' }]}>Fresh analysis • just now</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 8,
  },
  text: { fontSize: 12, fontWeight: '700' },
  icon: { fontSize: 15, fontWeight: '700' },
});
