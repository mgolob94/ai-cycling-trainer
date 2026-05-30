const { supabaseAdmin } = require('../db/supabase');
const strava = require('./strava');

// EWMA time constants (days) for the Performance Management Chart.
const ATL_DAYS = 7; // acute load / fatigue
const CTL_DAYS = 42; // chronic load / fitness

// Durations (seconds) for the power-duration curve.
const PDC_DURATIONS = [5, 10, 30, 60, 120, 300, 480, 600, 1200, 1800, 3600, 5400];

/** Monday (UTC) of the week containing `date`, as a Date at 00:00:00Z. */
function mondayOf(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

const round1 = (x) => Math.round(x * 10) / 10;

/**
 * Training Stress Score for a single ride.
 *
 * Power-based (preferred): TSS = (duration × NP × IF) / (FTP × 3600) × 100,
 * with IF = NP / FTP. Uses the ride's true normalized_power when available,
 * otherwise falls back to average power.
 *
 * If power is unavailable, fall back to a heart-rate estimate using the same
 * shape: TSS ≈ hours × (avgHR / thresholdHR)² × 100.
 *
 * Returns 0 when neither power+FTP nor HR+thresholdHR are available.
 */
function rideTss(ride, ftp, thresholdHr) {
  const durationSec = ride.duration_sec || 0;
  if (durationSec <= 0) return 0;

  const powerForTss = ride.normalized_power || ride.avg_power_w;
  if (powerForTss && ftp) {
    const np = powerForTss;
    const intensityFactor = np / ftp;
    return ((durationSec * np * intensityFactor) / (ftp * 3600)) * 100;
  }

  if (ride.avg_heart_rate && thresholdHr) {
    const hours = durationSec / 3600;
    const intensity = ride.avg_heart_rate / thresholdHr;
    return hours * intensity * intensity * 100;
  }

  return 0;
}

/** Estimate lactate-threshold HR from age: ~90% of max HR (220 − age). */
function estimateThresholdHr(age) {
  if (!age) return null;
  return Math.round((220 - age) * 0.9);
}

/**
 * Compute weekly training-load metrics from a set of rides.
 *
 * Daily TSS feeds the ATL/CTL exponential recurrences day by day across the
 * whole history (so CTL/ATL are seeded correctly); each week then records its
 * total TSS, ride aggregates, and the ATL/CTL/TSB as of the end of that week.
 *
 * Returns an array of weekly metric objects sorted by week_start ascending.
 */
function computeWeeklyMetrics(rides, { ftp, thresholdHr } = {}) {
  const dated = rides.filter((r) => r.ride_date);
  if (!dated.length) return [];

  // Daily TSS totals.
  const dailyTss = {};
  for (const ride of dated) {
    dailyTss[ride.ride_date] = (dailyTss[ride.ride_date] || 0) + rideTss(ride, ftp, thresholdHr);
  }

  const firstDate = dated.reduce(
    (min, r) => (r.ride_date < min ? r.ride_date : min),
    dated[0].ride_date
  );
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Walk every day from the first ride to today, evolving ATL/CTL.
  const dayMetrics = {};
  let atl = 0;
  let ctl = 0;
  for (let d = new Date(`${firstDate}T00:00:00Z`); d <= today; d = addDays(d, 1)) {
    const key = isoDate(d);
    const tss = dailyTss[key] || 0;
    atl += (tss - atl) / ATL_DAYS;
    ctl += (tss - ctl) / CTL_DAYS;
    dayMetrics[key] = { tss, atl, ctl, tsb: ctl - atl };
  }

  // Aggregate into weeks (Monday-based).
  const weeks = [];
  for (
    let wk = mondayOf(`${firstDate}T00:00:00Z`);
    wk <= mondayOf(today);
    wk = addDays(wk, 7)
  ) {
    const weekStart = isoDate(wk);
    const weekEnd = addDays(wk, 6);

    let weekTss = 0;
    for (let d = new Date(wk); d <= weekEnd && d <= today; d = addDays(d, 1)) {
      weekTss += dayMetrics[isoDate(d)]?.tss || 0;
    }

    const weekRides = dated.filter(
      (r) => r.ride_date >= weekStart && r.ride_date <= isoDate(weekEnd)
    );
    const powerRides = weekRides.filter((r) => r.avg_power_w != null);

    // PMC values as of the end of the week (clamped to today for the current week).
    const sampleDay = isoDate(weekEnd <= today ? weekEnd : today);
    const pmc = dayMetrics[sampleDay] || { atl: 0, ctl: 0, tsb: 0 };

    weeks.push({
      week_start: weekStart,
      tss: round1(weekTss),
      atl: round1(pmc.atl),
      ctl: round1(pmc.ctl),
      tsb: round1(pmc.tsb),
      total_distance_km: round1(weekRides.reduce((s, r) => s + (r.distance_km || 0), 0)),
      total_duration_sec: weekRides.reduce((s, r) => s + (r.duration_sec || 0), 0),
      total_elevation_m: round1(weekRides.reduce((s, r) => s + (r.elevation_m || 0), 0)),
      avg_power_w: powerRides.length
        ? round1(powerRides.reduce((s, r) => s + r.avg_power_w, 0) / powerRides.length)
        : null,
      ride_count: weekRides.length,
    });
  }

  return weeks;
}

/** Latest recorded FTP for a user, or null. */
async function getLatestFtp(userId) {
  const { data } = await supabaseAdmin
    .from('ftp_tests')
    .select('ftp_watts')
    .eq('user_id', userId)
    .order('test_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ftp_watts ?? null;
}

/**
 * Compute weekly metrics for a user from their ride history and persist them to
 * performance_metrics (upsert per week). Returns the weekly metrics array.
 */
async function calculateAndStore(userId) {
  const [{ data: rides, error: ridesError }, { data: profile }, ftp] = await Promise.all([
    supabaseAdmin
      .from('rides')
      .select('*')
      .eq('user_id', userId)
      .order('ride_date', { ascending: true }),
    supabaseAdmin.from('users').select('age').eq('id', userId).single(),
    getLatestFtp(userId),
  ]);
  if (ridesError) throw ridesError;

  const thresholdHr = estimateThresholdHr(profile?.age);
  const weeks = computeWeeklyMetrics(rides || [], { ftp, thresholdHr });

  if (weeks.length) {
    const rows = weeks.map((w) => ({ user_id: userId, ...w }));
    const { error } = await supabaseAdmin
      .from('performance_metrics')
      .upsert(rows, { onConflict: 'user_id,week_start' });
    if (error) throw error;
  }

  return weeks;
}

// ===========================================================================
// Advanced power calculations (operate on a 1-second power stream)
// ===========================================================================

const NP_WINDOW = 30; // seconds
const NP_MIN_SAMPLES = 30 * 60; // require > 30 min of power data
const XPOWER_WINDOW = 25; // seconds

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function fourthRootOfMeanOfFourthPowers(values) {
  if (!values.length) return 0;
  const meanFourth = values.reduce((s, v) => s + v ** 4, 0) / values.length;
  return meanFourth ** 0.25;
}

/** Trailing simple moving average over `window` seconds. */
function trailingMovingAverage(stream, window) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < stream.length; i += 1) {
    sum += stream[i];
    if (i >= window) sum -= stream[i - window];
    const count = Math.min(i + 1, window);
    out.push(sum / count);
  }
  return out;
}

/**
 * Normalized Power: 30s rolling average → 4th power → mean → 4th root.
 * Returns null unless the ride has > 30 min of power data.
 */
function normalizedPower(stream) {
  if (!stream || stream.length <= NP_MIN_SAMPLES) return null;
  const rolling = trailingMovingAverage(stream, NP_WINDOW);
  return fourthRootOfMeanOfFourthPowers(rolling);
}

/** xPower (BikeScore): 25s EWMA → 4th power → mean → 4th root. */
function xPower(stream) {
  if (!stream || !stream.length) return null;
  const alpha = 1 - Math.exp(-1 / XPOWER_WINDOW);
  const ema = [];
  let prev = stream[0];
  for (let i = 0; i < stream.length; i += 1) {
    prev = i === 0 ? stream[0] : prev + alpha * (stream[i] - prev);
    ema.push(prev);
  }
  return fourthRootOfMeanOfFourthPowers(ema);
}

/**
 * Best average power for each PDC duration (rolling max of windowed averages),
 * computed with prefix sums. Returns { [durationSec]: watts } for windows that
 * fit within the stream.
 */
function powerDurationCurve(stream) {
  const curve = {};
  const n = stream ? stream.length : 0;
  if (!n) return curve;

  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + stream[i];

  for (const w of PDC_DURATIONS) {
    if (w > n) continue;
    let best = -Infinity;
    for (let j = 0; j + w <= n; j += 1) {
      const avg = (prefix[j + w] - prefix[j]) / w;
      if (avg > best) best = avg;
    }
    curve[w] = Math.round(best);
  }
  return curve;
}

/**
 * Full power analysis for one ride from its power stream + avg HR.
 * Returns the values to store on the ride row.
 */
function analyzeRidePower(powerStream, avgHr) {
  const stream = (powerStream || []).map((p) => (Number.isFinite(p) ? p : 0));
  const np = normalizedPower(stream);
  const xp = xPower(stream);
  const avg = mean(stream);

  return {
    normalized_power: np != null ? Math.round(np) : null,
    xpower: xp != null ? Math.round(xp) : null,
    variability_index: np && avg ? Math.round((np / avg) * 100) / 100 : null,
    efficiency_factor: np && avgHr ? Math.round((np / avgHr) * 100) / 100 : null,
    power_curve: powerDurationCurve(stream),
  };
}

/** Upsert a ride's power-curve values into the user's all-time bests. */
async function updatePowerDurationBests(userId, powerCurve, achievedDate) {
  const { data: existing } = await supabaseAdmin
    .from('power_duration_bests')
    .select('duration_sec, power_watts')
    .eq('user_id', userId);
  const bestByDuration = new Map((existing || []).map((r) => [r.duration_sec, r.power_watts]));

  const rows = [];
  for (const [durationSec, watts] of Object.entries(powerCurve)) {
    const d = Number(durationSec);
    const prev = bestByDuration.get(d);
    if (prev == null || watts > prev) {
      rows.push({ user_id: userId, duration_sec: d, power_watts: watts, achieved_date: achievedDate });
    }
  }
  if (rows.length) {
    await supabaseAdmin
      .from('power_duration_bests')
      .upsert(rows, { onConflict: 'user_id,duration_sec' });
  }
}

/**
 * Fetch one ride's power stream from Strava, compute the advanced power
 * metrics, store them on the ride, and update the user's power-duration bests.
 * Returns true if the ride was analyzed.
 */
async function recalcRidePower(userId, ride) {
  let stream;
  try {
    stream = await strava.fetchActivityPowerStream(userId, ride.strava_id);
  } catch {
    return false; // activity gone / no token — skip
  }
  if (!stream || !stream.length) return false;

  const analysis = analyzeRidePower(stream, ride.avg_heart_rate);

  const { error } = await supabaseAdmin
    .from('rides')
    .update({
      normalized_power: analysis.normalized_power,
      xpower: analysis.xpower,
      variability_index: analysis.variability_index,
      efficiency_factor: analysis.efficiency_factor,
      power_curve: analysis.power_curve,
    })
    .eq('id', ride.id);
  if (error) throw error;

  await updatePowerDurationBests(userId, analysis.power_curve, ride.ride_date);
  return true;
}

/**
 * Backfill advanced power metrics for a user's rides. By default processes only
 * rides without a power_curve yet (so it fills in over time / on first run),
 * capped per call to respect Strava rate limits. Best-effort.
 */
async function recalcAllRidesPower(userId, { onlyMissing = true, limit = 25 } = {}) {
  let query = supabaseAdmin
    .from('rides')
    .select('*')
    .eq('user_id', userId)
    .order('ride_date', { ascending: false })
    .limit(limit);
  if (onlyMissing) query = query.is('power_curve', null);

  const { data: rides, error } = await query;
  if (error) throw error;

  let analyzed = 0;
  for (const ride of rides || []) {
    try {
      if (await recalcRidePower(userId, ride)) analyzed += 1;
    } catch (e) {
      console.warn('[power] recalc failed for ride', ride.strava_id, e.message);
    }
  }
  return { analyzed, considered: (rides || []).length };
}

module.exports = {
  rideTss,
  estimateThresholdHr,
  computeWeeklyMetrics,
  calculateAndStore,
  normalizedPower,
  xPower,
  powerDurationCurve,
  analyzeRidePower,
  recalcRidePower,
  recalcAllRidesPower,
};
