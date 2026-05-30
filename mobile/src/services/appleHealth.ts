import { Platform } from 'react-native';
import AppleHealthKit, {
  type HealthKitPermissions,
  type HealthValue,
  type HealthInputOptions,
} from 'react-native-health';

import { supabase } from './supabase';

// Apple Health (HealthKit) integration for HRV + sleep + resting HR. iOS only;
// every public function is a no-op on Android. Requires a dev/standalone build
// (HealthKit is unavailable in Expo Go).

const SOURCE = 'apple_health' as const;

export interface HRVReading {
  recorded_at: string; // ISO
  hrv_ms: number; // RMSSD estimate
  source: typeof SOURCE;
  raw_data?: Record<string, unknown>;
}

export interface HRReading {
  recorded_at: string;
  resting_hr: number;
}

export interface SleepSession {
  date: string; // night, dated by the evening before (YYYY-MM-DD)
  sleep_start: string | null;
  sleep_end: string | null;
  duration_min: number;
  deep_min: number;
  rem_min: number;
  light_min: number;
  awake_min: number;
  sleep_score: number | null;
  source: typeof SOURCE;
  raw_data?: Record<string, unknown>;
}

export interface SyncResult {
  available: boolean;
  hrv_synced: number;
  sleep_synced: number;
  last_reading_date: string | null;
}

// Apple's sleep samples carry a string category in `value`; the lib's HealthValue
// types it as number, so we read it through this shape.
interface SleepSample {
  startDate: string;
  endDate: string;
  value: string;
}

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.HeartRate,
    ],
    write: [],
  },
};

const isIOS = Platform.OS === 'ios';

function startDateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// --- callback → promise wrappers -------------------------------------------
function initHealthKit(): Promise<void> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err: string) => (err ? reject(new Error(err)) : resolve()));
  });
}

function getSamples<T>(
  method: (opts: HealthInputOptions, cb: (err: string, results: T[]) => void) => void,
  options: HealthInputOptions
): Promise<T[]> {
  return new Promise((resolve) => {
    method(options, (err, results) => resolve(err ? [] : results || []));
  });
}

// ---------------------------------------------------------------------------
// 6. Availability
// ---------------------------------------------------------------------------
export function isAvailable(): Promise<boolean> {
  if (!isIOS) return Promise.resolve(false);
  return new Promise((resolve) => {
    AppleHealthKit.isAvailable((err: Object, available: boolean) => resolve(!err && available));
  });
}

/** Prompt for HealthKit read permissions (no-op off iOS). */
export async function requestPermissions(): Promise<boolean> {
  if (!isIOS) return false;
  try {
    await initHealthKit();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. HRV
// ---------------------------------------------------------------------------
export async function fetchHRVData(days = 30): Promise<HRVReading[]> {
  if (!isIOS) return [];
  const samples = await getSamples<HealthValue>(
    AppleHealthKit.getHeartRateVariabilitySamples.bind(AppleHealthKit),
    { startDate: startDateNDaysAgo(days), ascending: false }
  );
  return samples
    .filter((s) => typeof s.value === 'number' && s.value > 0)
    .map((s) => {
      // HealthKit SDNN may arrive in seconds (~0.05) or ms; normalize to ms.
      const sdnnMs = s.value < 1 ? s.value * 1000 : s.value;
      return {
        recorded_at: s.startDate,
        hrv_ms: Math.round(sdnnMs * 0.85 * 10) / 10, // SDNN → RMSSD estimate
        source: SOURCE,
        raw_data: { sdnn_ms: Math.round(sdnnMs * 10) / 10, startDate: s.startDate, endDate: s.endDate },
      };
    })
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

// ---------------------------------------------------------------------------
// 4. Resting HR
// ---------------------------------------------------------------------------
export async function fetchRestingHR(days = 30): Promise<HRReading[]> {
  if (!isIOS) return [];
  const samples = await getSamples<HealthValue>(
    AppleHealthKit.getRestingHeartRateSamples.bind(AppleHealthKit),
    { startDate: startDateNDaysAgo(days), ascending: false }
  );
  return samples
    .filter((s) => typeof s.value === 'number' && s.value > 0)
    .map((s) => ({ recorded_at: s.startDate, resting_hr: Math.round(s.value) }))
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

// ---------------------------------------------------------------------------
// 3. Sleep — merge Apple's segments into nights
// ---------------------------------------------------------------------------
// Assign a sample to a "night date" = the evening before. Anything starting
// from noon onward belongs to that day's night; early-morning samples belong to
// the previous day.
function nightDateOf(startISO: string): string {
  const d = new Date(startISO);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function stageOf(value: string): 'deep' | 'rem' | 'light' | 'awake' | 'inbed' {
  const v = value.toUpperCase();
  if (v.includes('DEEP')) return 'deep';
  if (v.includes('REM')) return 'rem';
  if (v.includes('AWAKE')) return 'awake';
  if (v === 'INBED') return 'inbed';
  return 'light'; // CORE / ASLEEP / ASLEEPUNSPECIFIED / LIGHT
}

export async function fetchSleepData(days = 30): Promise<SleepSession[]> {
  if (!isIOS) return [];
  const raw = await getSamples<SleepSample>(
    AppleHealthKit.getSleepSamples.bind(AppleHealthKit) as never,
    { startDate: startDateNDaysAgo(days), ascending: true }
  );

  const nights = new Map<string, SleepSession>();
  for (const seg of raw) {
    if (!seg.startDate || !seg.endDate) continue;
    const stage = stageOf(seg.value);
    if (stage === 'inbed') continue; // overlaps the asleep segments — skip
    const date = nightDateOf(seg.startDate);
    const mins = minutesBetween(seg.startDate, seg.endDate);

    let night = nights.get(date);
    if (!night) {
      night = {
        date,
        sleep_start: seg.startDate,
        sleep_end: seg.endDate,
        duration_min: 0,
        deep_min: 0,
        rem_min: 0,
        light_min: 0,
        awake_min: 0,
        sleep_score: null,
        source: SOURCE,
        raw_data: { segments: 0 },
      };
      nights.set(date, night);
    }
    if (seg.startDate < (night.sleep_start ?? seg.startDate)) night.sleep_start = seg.startDate;
    if (seg.endDate > (night.sleep_end ?? seg.endDate)) night.sleep_end = seg.endDate;
    (night.raw_data as { segments: number }).segments += 1;

    if (stage === 'awake') {
      night.awake_min += mins;
    } else {
      night.duration_min += mins; // asleep total
      night[`${stage}_min` as 'deep_min' | 'rem_min' | 'light_min'] += mins;
    }
  }

  return [...nights.values()]
    .map((n) => ({
      ...n,
      duration_min: Math.round(n.duration_min),
      deep_min: Math.round(n.deep_min),
      rem_min: Math.round(n.rem_min),
      light_min: Math.round(n.light_min),
      awake_min: Math.round(n.awake_min),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// 5. Sync to Supabase
// ---------------------------------------------------------------------------
export async function syncToDatabase(userId: string): Promise<SyncResult> {
  if (!isIOS) return { available: false, hrv_synced: 0, sleep_synced: 0, last_reading_date: null };

  const granted = await requestPermissions();
  if (!granted) return { available: false, hrv_synced: 0, sleep_synced: 0, last_reading_date: null };

  const [hrv, sleep, restingHr] = await Promise.all([fetchHRVData(30), fetchSleepData(30), fetchRestingHR(30)]);

  // Attach the day's resting HR to the matching HRV reading.
  const rhrByDate = new Map<string, number>();
  for (const r of restingHr) {
    const day = r.recorded_at.slice(0, 10);
    if (!rhrByDate.has(day)) rhrByDate.set(day, r.resting_hr);
  }

  let hrvSynced = 0;
  if (hrv.length) {
    const rows = hrv.map((h) => ({
      user_id: userId,
      recorded_at: h.recorded_at,
      hrv_ms: h.hrv_ms,
      resting_hr: rhrByDate.get(h.recorded_at.slice(0, 10)) ?? null,
      source: SOURCE,
      raw_data: h.raw_data ?? null,
    }));
    const { error, count } = await supabase
      .from('hrv_readings')
      .upsert(rows, { onConflict: 'user_id,recorded_at,source', count: 'exact' });
    if (!error) hrvSynced = count ?? rows.length;
  }

  let sleepSynced = 0;
  if (sleep.length) {
    const rows = sleep.map((s) => ({ user_id: userId, ...s, raw_data: s.raw_data ?? null }));
    const { error, count } = await supabase
      .from('sleep_sessions')
      .upsert(rows, { onConflict: 'user_id,date,source', count: 'exact' });
    if (!error) sleepSynced = count ?? rows.length;
  }

  // Mark the source connection as synced (best-effort).
  await supabase
    .from('source_connections')
    .upsert(
      { user_id: userId, source: SOURCE, is_connected: true, last_sync_at: new Date().toISOString() },
      { onConflict: 'user_id,source' }
    );

  const lastReadingDate = hrv[0]?.recorded_at?.slice(0, 10) ?? sleep[0]?.date ?? null;
  return { available: true, hrv_synced: hrvSynced, sleep_synced: sleepSynced, last_reading_date: lastReadingDate };
}
