// Mock data service — simulates external data sources during development so the
// whole app can be built without a physical iPhone or external APIs. Consumed
// only through dataSource.ts (never imported directly by screens/hooks).
//
// Output is deterministic (fixed seed) so demo mode + validation look the same
// every run. Copy/names are English to match the app.

export interface MockHRVReading {
  recorded_at: string;
  hrv_ms: number;
  resting_hr: number;
  source: 'mock';
}

export interface MockSleepSession {
  date: string;
  sleep_start: string;
  sleep_end: string;
  duration_min: number;
  deep_min: number;
  rem_min: number;
  light_min: number;
  awake_min: number;
  sleep_score: number;
  source: 'mock';
}

export interface MockRecoveryScore {
  date: string;
  recovery_score: number;
  hrv_score: number;
  sleep_score: number;
  training_load_score: number;
  readiness_label: string;
  recommendation: string;
}

export interface MockRide {
  id: string;
  strava_id: string;
  ride_date: string;
  distance_km: number;
  duration_sec: number;
  avg_power_w: number;
  normalized_power: number;
  avg_heart_rate: number;
  elevation_m: number;
}

export interface MockFTPTest {
  ftp_watts: number;
  watts_per_kg: number;
  test_date: string;
}

export interface MockUserProfile {
  name: string;
  age: number;
  weight_kg: number;
  ftp_watts: number;
  watts_per_kg: number;
  goal: string;
  knowledge_level: string;
}

// Seeded PRNG (mulberry32) — deterministic across runs.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_SEED = 1337;
const FTP = 287;
const WEIGHT = 72;

function daysAgoISO(days: number, hour = 7): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
function daysAgoDate(days: number): string {
  return daysAgoISO(days).slice(0, 10);
}
function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// 1. HRV
// ---------------------------------------------------------------------------
export function generateMockHRV(days = 30, seed = DEFAULT_SEED): MockHRVReading[] {
  const r = rng(seed);
  // Pick 2–3 "bad" days to dip.
  const dipDays = new Set<number>();
  const dipCount = 2 + Math.floor(r() * 2);
  while (dipDays.size < dipCount) dipDays.add(Math.floor(r() * days));

  const out: MockHRVReading[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dow = date.getDay(); // 0=Sun
    const trend = ((days - 1 - i) / (days - 1)) * 5; // +5ms over the window
    const weekly = dow === 1 || dow === 2 ? -4 : 0; // Mon/Tue lower
    const noise = (r() - 0.5) * 16; // ±8
    const dip = dipDays.has(i) ? -15 : 0;
    const hrv = round(Math.max(20, 55 + trend + weekly + noise + dip), 1);
    out.push({
      recorded_at: daysAgoISO(i),
      hrv_ms: hrv,
      resting_hr: Math.round(48 + (r() - 0.5) * 4 - (hrv - 55) * 0.15),
      source: 'mock',
    });
  }
  return out.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

// ---------------------------------------------------------------------------
// 2. Sleep
// ---------------------------------------------------------------------------
export function generateMockSleep(days = 30, seed = DEFAULT_SEED + 1): MockSleepSession[] {
  const r = rng(seed);
  const out: MockSleepSession[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6;
    const poorNight = r() < 0.18; // ~1–2x/week

    let duration = 440 + (r() - 0.5) * 90; // 7h20 ± 45min
    if (weekend) duration += 30 + r() * 15;
    if (poorNight) duration = 330; // 5h30

    const deepPct = poorNight ? 0.12 : 0.18 + r() * 0.04;
    const remPct = 0.2 + r() * 0.05;
    const deep = Math.round(duration * deepPct);
    const rem = Math.round(duration * remPct);
    const awake = Math.round(10 + r() * 25);
    const light = Math.max(0, Math.round(duration) - deep - rem);

    // Score: 60% duration (7.5h target) + 40% restorative fraction (40% target).
    const durScore = Math.min(100, (duration / 450) * 100);
    const qualScore = Math.min(100, ((deep + rem) / duration / 0.4) * 100);
    const sleepScore = Math.round(durScore * 0.6 + qualScore * 0.4);

    const end = new Date(date);
    end.setHours(7, Math.round(r() * 40), 0, 0);
    const start = new Date(end.getTime() - (duration + awake) * 60000);

    out.push({
      date: daysAgoDate(i),
      sleep_start: start.toISOString(),
      sleep_end: end.toISOString(),
      duration_min: Math.round(duration),
      deep_min: deep,
      rem_min: rem,
      light_min: light,
      awake_min: awake,
      sleep_score: sleepScore,
      source: 'mock',
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// 3. Recovery scores (mirrors recoveryScore.js: HRV 40 / sleep 35 / load 25)
// ---------------------------------------------------------------------------
function readiness(score: number): { label: string; recommendation: string } {
  if (score >= 85) return { label: 'optimal', recommendation: 'You can handle anything today — intervals, a long ride, or a race.' };
  if (score >= 70) return { label: 'good', recommendation: 'Good recovery. Train as planned.' };
  if (score >= 50) return { label: 'moderate', recommendation: 'Ease intensity by 15–20%. Prioritize Zone 2.' };
  if (score >= 30) return { label: 'poor', recommendation: 'Easy ride or a rest day. Focus on sleep tonight.' };
  return { label: 'rest', recommendation: 'Your body needs rest. No training today.' };
}

export function generateMockRecoveryScores(days = 30, seed = DEFAULT_SEED): MockRecoveryScore[] {
  const hrv = generateMockHRV(days, seed).slice().sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const sleep = generateMockSleep(days, seed + 1).slice().sort((a, b) => a.date.localeCompare(b.date));
  const baseline = hrv.reduce((s, h) => s + h.hrv_ms, 0) / (hrv.length || 1);
  const r = rng(seed + 2);

  const out: MockRecoveryScore[] = [];
  for (let i = 0; i < days; i += 1) {
    const h = hrv[i];
    const sl = sleep[i];
    const pct = baseline ? (h.hrv_ms - baseline) / baseline : 0;
    const hrvScore =
      pct > 0.1 ? 82 + pct * 60 : pct >= -0.1 ? 62 + pct * 120 : pct >= -0.2 ? 37 + (pct + 0.1) * 130 : 12;
    const sleepScore = sl.sleep_score;
    const loadScore = 60 + (r() - 0.5) * 40; // random realistic load when no TSS
    const recovery = Math.round(
      Math.max(0, Math.min(100, hrvScore)) * 0.4 + sleepScore * 0.35 + Math.max(0, Math.min(100, loadScore)) * 0.25
    );
    const { label, recommendation } = readiness(recovery);
    out.push({
      date: daysAgoDate(days - 1 - i),
      recovery_score: recovery,
      hrv_score: Math.round(Math.max(0, Math.min(100, hrvScore))),
      sleep_score: sleepScore,
      training_load_score: Math.round(Math.max(0, Math.min(100, loadScore))),
      readiness_label: label,
      recommendation,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// 4. Rides
// ---------------------------------------------------------------------------
type RideType = 'endurance' | 'threshold' | 'intervals';
function rideType(rand: number): RideType {
  if (rand < 0.6) return 'endurance';
  if (rand < 0.85) return 'threshold';
  return 'intervals';
}

export function generateMockRides(count = 50, seed = DEFAULT_SEED + 3): MockRide[] {
  const r = rng(seed);
  const out: MockRide[] = [];
  // ~4.5 rides/week → spread over the needed number of days.
  let dayCursor = 0;
  for (let i = 0; i < count; i += 1) {
    dayCursor += 1 + Math.floor(r() * 2); // 1–2 day gaps (≈4–5/week)
    const type = rideType(r());
    const distance =
      type === 'endurance' ? 50 + r() * 70 : type === 'threshold' ? 35 + r() * 40 : 30 + r() * 25;
    const speed = 27 + r() * 6; // km/h
    const durationSec = Math.round((distance / speed) * 3600);
    const ifByType = type === 'endurance' ? 0.68 : type === 'threshold' ? 0.85 : 0.92;
    const np = Math.round(FTP * ifByType * (0.95 + r() * 0.1));
    const avg = Math.round(np * (type === 'intervals' ? 0.82 : 0.92));
    out.push({
      id: `mock-${i}`,
      strava_id: `mock-${1000000 + i}`,
      ride_date: daysAgoDate(dayCursor),
      distance_km: round(distance, 1),
      duration_sec: durationSec,
      avg_power_w: avg,
      normalized_power: np,
      avg_heart_rate: Math.round(135 + ifByType * 40 + (r() - 0.5) * 8),
      elevation_m: Math.round(distance * (8 + r() * 12)),
    });
  }
  return out.sort((a, b) => b.ride_date.localeCompare(a.ride_date));
}

// ---------------------------------------------------------------------------
// 5. FTP history
// ---------------------------------------------------------------------------
export function generateMockFTPHistory(): MockFTPTest[] {
  const values = [245, 265, 287];
  const weeksAgo = [26, 17, 4];
  return values.map((ftp, i) => ({
    ftp_watts: ftp,
    watts_per_kg: round(ftp / WEIGHT, 2),
    test_date: daysAgoDate(weeksAgo[i] * 7),
  }));
}

// ---------------------------------------------------------------------------
// 6. User
// ---------------------------------------------------------------------------
export function generateMockUser(): MockUserProfile {
  return {
    name: 'Test Cyclist',
    age: 34,
    weight_kg: WEIGHT,
    ftp_watts: FTP,
    watts_per_kg: round(FTP / WEIGHT, 2),
    goal: 'endurance',
    knowledge_level: 'intermediate',
  };
}

export const MockData = {
  hrv: generateMockHRV,
  sleep: generateMockSleep,
  recovery: generateMockRecoveryScores,
  rides: generateMockRides,
  ftpHistory: generateMockFTPHistory,
  user: generateMockUser,
};
