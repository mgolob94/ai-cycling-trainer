import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, type ApiResponse } from './api';

// Decides when to surface the post-workout survey after a ride syncs. State
// (which rides have been answered / dismissed) lives in AsyncStorage, namespaced
// per user, so the survey is shown at most once per ride.

const MIN_DURATION_SEC = 15 * 60; // skip very short rides
const MAX_AGE_HOURS = 48; // never ask about rides older than this
const DISMISS_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h after a dismissal

const answeredKey = (userId: string) => `survey:answered:${userId}`;
const dismissedKey = (userId: string) => `survey:dismissed:${userId}`;

export interface SurveyTrigger {
  strava_activity_id: string;
  ride_title: string;
  distance_km: number | null;
  tss: number | null;
  workout_date: string | null;
}

interface RideRow {
  strava_id: string;
  distance_km: number | null;
  duration_sec: number | null;
  ride_date: string | null;
  tss: number | null;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A plain title for a ride from its date, e.g. "Saturday ride". */
function titleFor(rideDate: string | null): string {
  if (!rideDate) return 'Your ride';
  const day = new Date(`${rideDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  return `${day} ride`;
}

function hoursSince(date: string | null): number {
  if (!date) return Infinity;
  const t = new Date(`${date}T12:00:00`).getTime();
  return (Date.now() - t) / 3_600_000;
}

/**
 * The next ride that should prompt a post-workout survey, or null. Checks recent
 * rides against the eligibility rules (duration, age, not yet answered, not in
 * dismissal cooldown). Safe to call on app foreground and after a sync.
 */
export async function checkForPendingSurvey(userId: string): Promise<SurveyTrigger | null> {
  if (!userId) return null;

  let rides: RideRow[] = [];
  try {
    const { data } = await api.get<ApiResponse<RideRow[]>>('/rides', { params: { limit: 5 } });
    rides = data.data ?? [];
  } catch {
    return null;
  }

  const answered = await readJson<string[]>(answeredKey(userId), []);
  const dismissed = await readJson<Record<string, number>>(dismissedKey(userId), {});

  for (const ride of rides) {
    if (!ride.strava_id) continue;
    if ((ride.duration_sec ?? 0) < MIN_DURATION_SEC) continue;
    if (hoursSince(ride.ride_date) > MAX_AGE_HOURS) continue;
    if (answered.includes(ride.strava_id)) continue;
    const dismissedAt = dismissed[ride.strava_id];
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) continue;

    return {
      strava_activity_id: ride.strava_id,
      ride_title: titleFor(ride.ride_date),
      distance_km: ride.distance_km ?? null,
      tss: ride.tss ?? null,
      workout_date: ride.ride_date ?? null,
    };
  }
  return null;
}

/** Mark a ride's survey answered so it's never shown again. */
export async function markSurveyAnswered(userId: string, stravaActivityId: string): Promise<void> {
  const answered = await readJson<string[]>(answeredKey(userId), []);
  if (!answered.includes(stravaActivityId)) {
    answered.push(stravaActivityId);
    await AsyncStorage.setItem(answeredKey(userId), JSON.stringify(answered.slice(-50)));
  }
}

/** Record a dismissal — re-prompt for this ride is suppressed for the cooldown. */
export async function markSurveyDismissed(userId: string, stravaActivityId: string): Promise<void> {
  const dismissed = await readJson<Record<string, number>>(dismissedKey(userId), {});
  dismissed[stravaActivityId] = Date.now();
  await AsyncStorage.setItem(dismissedKey(userId), JSON.stringify(dismissed));
}
