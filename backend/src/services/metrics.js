const { supabaseAdmin } = require('../db/supabase');

// EWMA time constants (days) for the Performance Management Chart.
const ATL_DAYS = 7; // acute load / fatigue
const CTL_DAYS = 42; // chronic load / fitness

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
 * with IF = NP / FTP. We lack power streams, so NP is approximated by the
 * ride's average power.
 *
 * If power is unavailable, fall back to a heart-rate estimate using the same
 * shape: TSS ≈ hours × (avgHR / thresholdHR)² × 100.
 *
 * Returns 0 when neither power+FTP nor HR+thresholdHR are available.
 */
function rideTss(ride, ftp, thresholdHr) {
  const durationSec = ride.duration_sec || 0;
  if (durationSec <= 0) return 0;

  if (ride.avg_power_w && ftp) {
    const np = ride.avg_power_w; // approximation: no power stream available
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

module.exports = {
  rideTss,
  estimateThresholdHr,
  computeWeeklyMetrics,
  calculateAndStore,
};
