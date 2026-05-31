// Deterministic (seeded) mock generators — the Node/CommonJS twin of the
// mobile mockData.ts, shared by the seed, validation, and mock-server scripts.

const FTP = 287;
const WEIGHT = 72;
const DEFAULT_SEED = 1337;
const PDC_DURATIONS = [5, 10, 30, 60, 120, 300, 480, 600, 1200, 1800, 3600, 5400];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
function daysAgoISO(days, hour = 7) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
const daysAgoDate = (days) => daysAgoISO(days).slice(0, 10);

function generateHRV(days = 30, seed = DEFAULT_SEED) {
  const r = rng(seed);
  const dips = new Set();
  const dipCount = 2 + Math.floor(r() * 2);
  while (dips.size < dipCount) dips.add(Math.floor(r() * days));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dow = date.getDay();
    const trend = ((days - 1 - i) / (days - 1)) * 5;
    const weekly = dow === 1 || dow === 2 ? -4 : 0;
    const noise = (r() - 0.5) * 16;
    const dip = dips.has(i) ? -15 : 0;
    const hrv = round(Math.max(20, 55 + trend + weekly + noise + dip), 1);
    out.push({
      recorded_at: daysAgoISO(i),
      hrv_ms: hrv,
      resting_hr: Math.round(48 + (r() - 0.5) * 4 - (hrv - 55) * 0.15),
      source: 'mock',
    });
  }
  return out;
}

function generateSleep(days = 30, seed = DEFAULT_SEED + 1) {
  const r = rng(seed);
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6;
    const poor = r() < 0.18;
    let duration = 440 + (r() - 0.5) * 90;
    if (weekend) duration += 30 + r() * 15;
    if (poor) duration = 330;
    const deep = Math.round(duration * (poor ? 0.12 : 0.18 + r() * 0.04));
    const rem = Math.round(duration * (0.2 + r() * 0.05));
    const awake = Math.round(10 + r() * 25);
    const light = Math.max(0, Math.round(duration) - deep - rem);
    const durScore = Math.min(100, (duration / 450) * 100);
    const qualScore = Math.min(100, ((deep + rem) / duration / 0.4) * 100);
    out.push({
      date: daysAgoDate(i),
      duration_min: Math.round(duration),
      deep_min: deep,
      rem_min: rem,
      light_min: light,
      awake_min: awake,
      sleep_score: Math.round(durScore * 0.6 + qualScore * 0.4),
      source: 'mock',
    });
  }
  return out;
}

function powerCurveFor(np, durationSec) {
  // Plausible best-effort curve scaled around NP, only for windows that fit.
  const ratios = { 5: 2.4, 10: 2.1, 30: 1.6, 60: 1.4, 120: 1.2, 300: 1.08, 480: 1.03, 600: 1.0, 1200: 0.97, 1800: 0.94, 3600: 0.9, 5400: 0.86 };
  const curve = {};
  for (const d of PDC_DURATIONS) {
    if (d > durationSec) continue;
    curve[d] = Math.round(np * (ratios[d] ?? 0.9));
  }
  return curve;
}

function generateRides(days = 180, seed = DEFAULT_SEED + 3) {
  const r = rng(seed);
  const out = [];
  let cursor = 0;
  let i = 0;
  while (cursor < days) {
    cursor += 1 + Math.floor(r() * 2);
    if (cursor > days) break;
    const t = r();
    const type = t < 0.6 ? 'endurance' : t < 0.85 ? 'threshold' : 'intervals';
    const distance = type === 'endurance' ? 50 + r() * 70 : type === 'threshold' ? 35 + r() * 40 : 30 + r() * 25;
    const speed = 27 + r() * 6;
    const durationSec = Math.round((distance / speed) * 3600);
    const ifByType = type === 'endurance' ? 0.68 : type === 'threshold' ? 0.85 : 0.92;
    const np = Math.round(FTP * ifByType * (0.95 + r() * 0.1));
    const avg = Math.round(np * (type === 'intervals' ? 0.82 : 0.92));
    out.push({
      strava_id: `mock-${1000000 + i}`,
      ride_date: daysAgoDate(cursor),
      distance_km: round(distance, 1),
      duration_sec: durationSec,
      avg_power_w: avg,
      normalized_power: np,
      variability_index: round(np / avg, 2),
      avg_heart_rate: Math.round(135 + ifByType * 40 + (r() - 0.5) * 8),
      elevation_m: Math.round(distance * (8 + r() * 12)),
      power_curve: powerCurveFor(np, durationSec),
    });
    i += 1;
  }
  return out;
}

function generateFTPHistory() {
  const values = [245, 265, 287];
  const weeksAgo = [26, 17, 4];
  return values.map((ftp, i) => ({
    ftp_watts: ftp,
    watts_per_kg: round(ftp / WEIGHT, 2),
    test_date: daysAgoDate(weeksAgo[i] * 7),
  }));
}

function generateUser() {
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

module.exports = {
  FTP,
  WEIGHT,
  DEFAULT_SEED,
  PDC_DURATIONS,
  generateHRV,
  generateSleep,
  generateRides,
  generateFTPHistory,
  generateUser,
  daysAgoDate,
};
