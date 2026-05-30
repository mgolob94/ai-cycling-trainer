const { supabaseAdmin } = require('../db/supabase');

// Coggan method: FTP ≈ 95% of best 20-minute average power.
const FTP_FACTOR = 0.95;
const TWENTY_MIN_SEC = 20 * 60;

/**
 * Find the best 20-minute power effort across a set of rides.
 *
 * Ideally this uses each ride's true best rolling 20-min average from its power
 * stream. Our rides table only stores whole-ride average power, so as a fallback
 * we approximate the effort with the highest average power among rides that are
 * at least 20 minutes long. Callers can supply `best_20min_power_w` on a ride
 * (e.g. computed from a Strava power stream) to use the exact value instead.
 *
 * Returns { power, date, stravaId } for the best effort, or null if none.
 */
function findBest20MinEffort(rides) {
  let best = null;

  for (const ride of rides) {
    const power =
      ride.best_20min_power_w ??
      ((ride.duration_sec ?? 0) >= TWENTY_MIN_SEC ? ride.avg_power_w : null);

    if (power == null) continue;

    if (!best || power > best.power) {
      best = {
        power,
        date: ride.ride_date ?? null,
        stravaId: ride.strava_id ?? null,
      };
    }
  }

  return best;
}

/**
 * Estimate FTP from ride data. Returns FTP (watts), watts/kg (if weight known),
 * and the date of the best effort — or null if there isn't enough power data.
 */
function estimateFtp(rides, weightKg) {
  const best = findBest20MinEffort(rides);
  if (!best) return null;

  const ftpWatts = Math.round(best.power * FTP_FACTOR);
  const wattsPerKg = weightKg
    ? Math.round((ftpWatts / weightKg) * 100) / 100
    : null;

  return {
    ftp_watts: ftpWatts,
    watts_per_kg: wattsPerKg,
    best_20min_power_w: Math.round(best.power),
    best_effort_date: best.date,
    strava_activity_id: best.stravaId,
  };
}

/**
 * Estimate FTP from the given rides and persist it to ftp_tests. Returns the
 * estimate (with the stored row id), or null if there isn't enough power data.
 */
async function calculateAndStore(userId, rides, weightKg) {
  const result = estimateFtp(rides, weightKg);
  if (!result) return null;

  const { data, error } = await supabaseAdmin
    .from('ftp_tests')
    .insert({
      user_id: userId,
      ftp_watts: result.ftp_watts,
      weight_kg: weightKg ?? null,
      watts_per_kg: result.watts_per_kg,
      test_date: result.best_effort_date,
      notes: 'Estimated from ride history (95% of best 20-min average power).',
    })
    .select()
    .single();

  if (error) throw error;

  return { ...result, id: data.id };
}

/**
 * Recompute FTP for a user from their last 90 days of power rides and store it.
 * Fetches the rides and weight itself.
 *
 * With `recordOnlyIfChanged` (used by the post-sync hook), skips inserting a new
 * ftp_tests row when the estimate matches the latest stored one — so syncing
 * repeatedly doesn't pile up identical FTP records. Returns the estimate with a
 * `recorded` flag, or null if there isn't enough power data.
 */
async function recalculateForUser(userId, { recordOnlyIfChanged = false } = {}) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: rides, error: ridesError } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('user_id', userId)
    .gte('ride_date', ninetyDaysAgo.toISOString().slice(0, 10))
    .not('avg_power_w', 'is', null);
  if (ridesError) throw ridesError;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('weight_kg')
    .eq('id', userId)
    .single();
  const weightKg = profile?.weight_kg ?? null;

  const estimate = estimateFtp(rides || [], weightKg);
  if (!estimate) return null;

  if (recordOnlyIfChanged) {
    const { data: latest } = await supabaseAdmin
      .from('ftp_tests')
      .select('ftp_watts, test_date')
      .eq('user_id', userId)
      .order('test_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      latest &&
      latest.ftp_watts === estimate.ftp_watts &&
      latest.test_date === estimate.best_effort_date
    ) {
      return { ...estimate, recorded: false };
    }
  }

  const stored = await calculateAndStore(userId, rides || [], weightKg);
  return { ...stored, recorded: true };
}

/** All of the user's FTP tests, oldest first (for history/charting). */
async function getHistory(userId) {
  const { data, error } = await supabaseAdmin
    .from('ftp_tests')
    .select('ftp_watts, watts_per_kg, weight_kg, test_date, created_at')
    .eq('user_id', userId)
    .order('test_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** The user's most recent FTP test, or null. */
async function getLatest(userId) {
  const { data, error } = await supabaseAdmin
    .from('ftp_tests')
    .select('ftp_watts, watts_per_kg, weight_kg, test_date, created_at')
    .eq('user_id', userId)
    .order('test_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

module.exports = {
  findBest20MinEffort,
  estimateFtp,
  calculateAndStore,
  recalculateForUser,
  getLatest,
  getHistory,
};
