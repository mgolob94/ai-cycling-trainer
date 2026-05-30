const { supabaseAdmin } = require('../db/supabase');
const pushNotifications = require('./pushNotifications');

// Labels for personal-record notifications.
const RECORD_LABELS = {
  best_5min_power: 'Best 5-min power',
  best_20min_power: 'Best 20-min power',
  best_60min_power: 'Best 60-min power',
  longest_ride_km: 'Longest ride',
  most_elevation_m: 'Most elevation',
};

function unitLabel(unit) {
  return unit === 'watts' ? 'W' : unit;
}

// Personal record definitions. Power records take the exact best N-minute effort
// from power_duration_bests (computed from each ride's power stream) — keyed by
// the matching power-duration-curve window in seconds. Distance/elevation use
// the ride's stored totals directly.
const RECORD_DEFS = [
  { type: 'best_5min_power', unit: 'watts', pdcDuration: 300 },
  { type: 'best_20min_power', unit: 'watts', pdcDuration: 1200 },
  { type: 'best_60min_power', unit: 'watts', pdcDuration: 3600 },
  { type: 'longest_ride_km', unit: 'km', field: 'distance_km' },
  { type: 'most_elevation_m', unit: 'm', field: 'elevation_m' },
];

/** Find the best value of a stored ride field (distance/elevation) across rides. */
function bestCandidate(rides, def) {
  let best = null;

  for (const ride of rides) {
    const value = ride[def.field];
    if (value == null) continue;

    if (!best || value > best.value) {
      best = {
        value,
        strava_activity_id: ride.strava_id ?? null,
        achieved_date: ride.ride_date ?? null,
      };
    }
  }

  return best;
}

function roundValue(value, unit) {
  return unit === 'watts' ? Math.round(value) : Math.round(value * 10) / 10;
}

/** All current personal records for a user. */
async function getRecords(userId) {
  const { data, error } = await supabaseAdmin
    .from('personal_records')
    .select('record_type, value, unit, strava_activity_id, achieved_date')
    .eq('user_id', userId)
    .order('record_type', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Scan all of a user's rides, computing each record type's best effort, and
 * upsert it into personal_records — but only when it beats the existing record
 * (one row per record type is maintained). Returns the user's current records.
 */
async function scanAndUpsert(userId) {
  const [{ data: rides, error }, { data: pdcBests, error: pdcError }] = await Promise.all([
    supabaseAdmin.from('rides').select('*').eq('user_id', userId),
    supabaseAdmin
      .from('power_duration_bests')
      .select('duration_sec, power_watts, achieved_date')
      .eq('user_id', userId),
  ]);
  if (error) throw error;
  if (pdcError) throw pdcError;

  const pdcByDuration = new Map((pdcBests || []).map((d) => [d.duration_sec, d]));
  // Map a date → a ride's strava_id so power records can still link to a ride.
  const stravaIdByDate = new Map();
  for (const ride of rides || []) {
    if (ride.ride_date && ride.strava_id && !stravaIdByDate.has(ride.ride_date)) {
      stravaIdByDate.set(ride.ride_date, ride.strava_id);
    }
  }

  const beaten = [];

  for (const def of RECORD_DEFS) {
    let candidate;
    if (def.pdcDuration) {
      const best = pdcByDuration.get(def.pdcDuration);
      candidate = best
        ? {
            value: best.power_watts,
            strava_activity_id: stravaIdByDate.get(best.achieved_date) ?? null,
            achieved_date: best.achieved_date ?? null,
          }
        : null;
    } else {
      candidate = bestCandidate(rides || [], def);
    }
    if (!candidate) continue;

    const value = roundValue(candidate.value, def.unit);

    const { data: existing } = await supabaseAdmin
      .from('personal_records')
      .select('id, value')
      .eq('user_id', userId)
      .eq('record_type', def.type)
      .order('value', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Only record when there's no prior record or the candidate beats it.
    if (existing && existing.value >= value) continue;

    const row = {
      user_id: userId,
      record_type: def.type,
      value,
      unit: def.unit,
      strava_activity_id: candidate.strava_activity_id,
      achieved_date: candidate.achieved_date,
    };

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('personal_records')
        .update(row)
        .eq('id', existing.id);
      if (updateError) throw updateError;
      // An existing record was beaten — that's a notable new PR.
      beaten.push({ type: def.type, value, unit: def.unit });
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('personal_records')
        .insert(row);
      if (insertError) throw insertError;
    }
  }

  // Notify on beaten records (best-effort; never fails the scan).
  for (const pr of beaten) {
    const label = RECORD_LABELS[pr.type] ?? pr.type;
    pushNotifications
      .sendToUser(userId, {
        title: 'New personal record! 🏆',
        body: `${label}: ${pr.value} ${unitLabel(pr.unit)}`,
        data: { screen: 'Progress' },
      })
      .catch((e) => console.warn('[records push]', e.message));
  }

  return getRecords(userId);
}

module.exports = { RECORD_DEFS, bestCandidate, getRecords, scanAndUpsert };
