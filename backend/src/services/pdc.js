const { supabaseAdmin } = require('../db/supabase');

// Pre-migration safety: treat "table/column doesn't exist yet" as no data.
function isMissingSchema(error) {
  const msg = `${error?.message || ''} ${error?.code || ''}`;
  return /does not exist|Could not find the table|schema cache|42703|PGRST20/i.test(msg);
}

/** Human label for a duration in seconds, e.g. 5→"5s", 300→"5min", 3600→"1hr". */
function durationLabel(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${sec / 60}min`;
  if (sec % 3600 === 0) return `${sec / 3600}hr`;
  return `${sec / 60}min`;
}

function shape(durationSec, powerWatts, achievedDate) {
  return {
    duration_sec: durationSec,
    duration_label: durationLabel(durationSec),
    power_watts: powerWatts,
    achieved_date: achievedDate ?? null,
  };
}

/** All-time PDC from the power_duration_bests table. */
async function getAllTime(userId) {
  const { data, error } = await supabaseAdmin
    .from('power_duration_bests')
    .select('duration_sec, power_watts, achieved_date')
    .eq('user_id', userId)
    .order('duration_sec', { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return (data || []).map((r) => shape(r.duration_sec, r.power_watts, r.achieved_date));
}

/**
 * PDC computed on the fly from rides' stored power_curve JSON within a date
 * range (sinceDate inclusive, or all rides if null). Returns the best power per
 * duration plus the date it was achieved.
 */
async function computeFromRides(userId, sinceDate) {
  let query = supabaseAdmin
    .from('rides')
    .select('ride_date, power_curve')
    .eq('user_id', userId)
    .not('power_curve', 'is', null);
  if (sinceDate) query = query.gte('ride_date', sinceDate);

  const { data: rides, error } = await query;
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }

  const best = {}; // duration_sec -> { power, date }
  for (const ride of rides || []) {
    const curve = ride.power_curve || {};
    for (const [d, watts] of Object.entries(curve)) {
      const dur = Number(d);
      if (!best[dur] || watts > best[dur].power) {
        best[dur] = { power: watts, date: ride.ride_date };
      }
    }
  }

  return Object.keys(best)
    .map((d) => shape(Number(d), best[d].power, best[d].date))
    .sort((a, b) => a.duration_sec - b.duration_sec);
}

module.exports = { durationLabel, getAllTime, computeFromRides };
