import AsyncStorage from '@react-native-async-storage/async-storage';

// One-time "what do these metrics mean?" education, shown after the first sync.
const SEEN_KEY = 'metricsIntro.seen';

export async function hasSeenMetricsIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(SEEN_KEY)) === 'true';
}

export async function markMetricsIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, 'true');
}
