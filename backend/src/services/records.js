const { supabaseAdmin } = require('../db/supabase');
const pushNotifications = require('./pushNotifications');

// Slovenian labels for personal-record notifications.
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

// Personal record definitions. Power records approximate the best N-minute
// effort with the highest whole-ride average power among rides at least that
// long (we don't store power streams); a ride may carry an exact
// `best_Nmin_power_w` field to be used instead. Distance/elevation use the
// ride's stored totals directly.
const RECORD_DEFS = [
  { type: 'best_5min_power', unit: 'watts', minDuration: 300, field: 'avg_power_w', streamField: 'best_5min_power_w' },
  { type: 'best_20min_power', unit: 'watts', minDuration: 1200, field: 'avg_power_w', streamField: 'best_20min_power_w' },
  { type: 'best_60min_power', unit: 'watts', minDuration: 3600, field: 'avg_power_w', streamField: 'best_60min_power_w' },
  { type: 'longest_ride_km', unit: 'km', field: 'distance_km' },
  { type: 'most_elevation_m', unit: 'm', field: 'elevation_m' },
];

/** Find the best value for a record definition across a set of rides. */
function bestCandidate(rides, def) {
  let best = null;

  for (const ride of rides) {
    let value;
    if (def.minDuration) {
      value =
        def.streamField && ride[def.streamField] != null
          ? ride[def.streamField]
          : (ride.duration_sec ?? 0) >= def.minDuration
            ? ride[def.field]
            : null;
    } else {
      value = ride[def.field];
    }

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
  const { data: rides, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;

  const beaten = [];

  for (const def of RECORD_DEFS) {
    const candidate = bestCandidate(rides || [], def);
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
