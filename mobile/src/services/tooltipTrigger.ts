import AsyncStorage from '@react-native-async-storage/async-storage';

// Tracks which metric explainers a user has already seen, so the one-time
// first-encounter hint shows exactly once per metric (never spam).

const SEEN_KEY = 'seen_tooltips';

async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** True only if this metric's first-encounter hint hasn't been shown yet. */
export async function shouldShowFirstEncounter(metric: string): Promise<boolean> {
  const seen = await readSeen();
  return !seen.includes(metric);
}

/** Record that the metric's hint has been shown (idempotent). */
export async function markAsSeen(metric: string): Promise<void> {
  const seen = await readSeen();
  if (seen.includes(metric)) return;
  seen.push(metric);
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // best-effort; worst case the hint shows again next launch
  }
}
