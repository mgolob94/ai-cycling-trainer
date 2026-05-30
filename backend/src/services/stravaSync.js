const axios = require('axios');
const { supabaseAdmin } = require('../db/supabase');
const strava = require('./strava');
const metrics = require('./metrics');

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const PER_PAGE = 200; // Strava max
const MAX_PAGES = 50; // safety cap (~10k activities) to respect rate limits
const RIDE_TYPES = new Set(['Ride', 'VirtualRide']);

/** Map a raw Strava activity to a `rides` row (keeps the raw JSON for reference). */
function toRideRow(userId, activity) {
  return {
    user_id: userId,
    strava_id: String(activity.id),
    distance_km: activity.distance != null ? activity.distance / 1000 : null,
    duration_sec: activity.moving_time ?? null,
    avg_power_w: activity.average_watts ?? null,
    avg_heart_rate: activity.average_heartrate ?? null,
    elevation_m: activity.total_elevation_gain ?? null,
    ride_date: activity.start_date_local?.slice(0, 10) ?? null,
    raw_strava_data: activity,
    is_processed: false,
    synced_at: new Date().toISOString(),
  };
}

function updateConnection(userId, fields) {
  return supabaseAdmin.from('strava_connections').update(fields).eq('user_id', userId);
}

/** Fetch one page of the athlete's activities. */
async function fetchPage(token, { page, after }) {
  const { data } = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { per_page: PER_PAGE, page, ...(after ? { after } : {}) },
  });
  return data || [];
}

// ---------------------------------------------------------------------------
// 1. Full historical sync
// ---------------------------------------------------------------------------
async function syncAllActivities(userId) {
  const startedAt = new Date();

  await updateConnection(userId, {
    sync_status: 'syncing',
    initial_sync_started_at: startedAt.toISOString(),
    initial_sync_progress: 0,
    sync_error: null,
  });

  const { data: logRow } = await supabaseAdmin
    .from('sync_log')
    .insert({ user_id: userId, sync_type: 'initial', started_at: startedAt.toISOString(), status: 'running' })
    .select('id')
    .single();
  const logId = logRow?.id;

  try {
    const token = await strava.getValidAccessToken(userId);
    let fetched = 0;
    let rideCount = 0;
    let newestDate = null;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const activities = await fetchPage(token, { page });
      if (!activities.length) break;
      fetched += activities.length;

      for (const a of activities) {
        const d = a.start_date;
        if (d && (!newestDate || d > newestDate)) newestDate = d;
      }

      const rides = activities.filter((a) => RIDE_TYPES.has(a.type)).map((a) => toRideRow(userId, a));
      if (rides.length) {
        const { error } = await supabaseAdmin.from('rides').upsert(rides, { onConflict: 'strava_id' });
        if (error) throw error;
        rideCount += rides.length;
      }

      // Strava doesn't tell us the total upfront, so keep a rolling estimate:
      // assume at least one more full page while pages keep coming in full. This
      // gives the client a steadily-rising (approximate) percentage to show.
      const morePagesLikely = activities.length >= PER_PAGE;
      await updateConnection(userId, {
        initial_sync_progress: fetched,
        initial_sync_total_estimate: fetched + (morePagesLikely ? PER_PAGE : 0),
      });
      if (activities.length < PER_PAGE) break;
    }

    const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
    await updateConnection(userId, {
      initial_sync_completed: true,
      sync_status: 'completed',
      last_sync_at: new Date().toISOString(),
      last_activity_sync_at: newestDate,
      total_activities_synced: rideCount,
      initial_sync_total_estimate: fetched,
    });
    if (logId) {
      await supabaseAdmin
        .from('sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          activities_fetched: fetched,
          activities_new: rideCount,
          activities_updated: 0,
          duration_sec: durationSec,
        })
        .eq('id', logId);
    }

    await processUnprocessedRides(userId);
    return { success: true, total_fetched: fetched, duration_sec: durationSec };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
    await updateConnection(userId, { sync_status: 'error', sync_error: message });
    if (logId) {
      await supabaseAdmin
        .from('sync_log')
        .update({ status: 'error', error_message: message, completed_at: new Date().toISOString(), duration_sec: durationSec })
        .eq('id', logId);
    }
    return { success: false, error: message, duration_sec: durationSec };
  }
}

// ---------------------------------------------------------------------------
// 2. Incremental sync
// ---------------------------------------------------------------------------
async function syncNewActivities(userId, syncType = 'incremental') {
  const startedAt = new Date();

  const { data: conn } = await supabaseAdmin
    .from('strava_connections')
    .select('last_activity_sync_at')
    .eq('user_id', userId)
    .maybeSingle();

  // Only fetch activities newer than the last sync (fallback: last 4 weeks).
  const afterMs = conn?.last_activity_sync_at
    ? new Date(conn.last_activity_sync_at).getTime()
    : Date.now() - 28 * 24 * 3600 * 1000;
  const after = Math.floor(afterMs / 1000);

  const { data: logRow } = await supabaseAdmin
    .from('sync_log')
    .insert({ user_id: userId, sync_type: syncType, started_at: startedAt.toISOString(), status: 'running' })
    .select('id')
    .single();
  const logId = logRow?.id;

  try {
    const token = await strava.getValidAccessToken(userId);
    const collected = [];
    let newestDate = conn?.last_activity_sync_at || null;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const activities = await fetchPage(token, { page, after });
      if (!activities.length) break;
      for (const a of activities) {
        if (a.start_date && (!newestDate || a.start_date > newestDate)) newestDate = a.start_date;
      }
      collected.push(...activities.filter((a) => RIDE_TYPES.has(a.type)));
      if (activities.length < PER_PAGE) break;
    }

    let newCount = 0;
    let updatedCount = 0;
    if (collected.length) {
      const ids = collected.map((a) => String(a.id));
      const { data: existing } = await supabaseAdmin
        .from('rides')
        .select('strava_id')
        .eq('user_id', userId)
        .in('strava_id', ids);
      const existingSet = new Set((existing || []).map((r) => r.strava_id));
      newCount = ids.filter((i) => !existingSet.has(i)).length;
      updatedCount = ids.length - newCount;

      const rows = collected.map((a) => toRideRow(userId, a));
      const { error } = await supabaseAdmin.from('rides').upsert(rows, { onConflict: 'strava_id' });
      if (error) throw error;
    }

    const { data: conn2 } = await supabaseAdmin
      .from('strava_connections')
      .select('total_activities_synced')
      .eq('user_id', userId)
      .maybeSingle();

    await updateConnection(userId, {
      last_sync_at: new Date().toISOString(),
      last_activity_sync_at: newestDate,
      total_activities_synced: (conn2?.total_activities_synced ?? 0) + newCount,
      sync_status: 'completed',
      sync_error: null,
    });
    if (logId) {
      await supabaseAdmin
        .from('sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          activities_fetched: collected.length,
          activities_new: newCount,
          activities_updated: updatedCount,
          duration_sec: Math.round((Date.now() - startedAt.getTime()) / 1000),
        })
        .eq('id', logId);
    }

    await processUnprocessedRides(userId);
    return { success: true, new_activities: newCount, updated_activities: updatedCount };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    await updateConnection(userId, { sync_status: 'error', sync_error: message });
    if (logId) {
      await supabaseAdmin
        .from('sync_log')
        .update({ status: 'error', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', logId);
    }
    return { success: false, error: message, new_activities: 0, updated_activities: 0 };
  }
}

// ---------------------------------------------------------------------------
// 3. Process unprocessed rides (compute power metrics)
// ---------------------------------------------------------------------------
async function processUnprocessedRides(userId, { batchSize = 50, maxRides = 100 } = {}) {
  let processed = 0;

  while (processed < maxRides) {
    const { data: rides, error } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('user_id', userId)
      .eq('is_processed', false)
      .limit(batchSize);
    if (error) throw error;
    if (!rides || !rides.length) break;

    for (const ride of rides) {
      try {
        // Computes NP/xPower/VI/EF/power_curve from the Strava stream (when
        // available) and updates power_duration_bests.
        await metrics.recalcRidePower(userId, ride);
      } catch (e) {
        console.warn('[sync] processing failed for ride', ride.strava_id, e.message);
      }
      // Mark processed regardless (no power data → nothing to compute; don't retry).
      await supabaseAdmin.from('rides').update({ is_processed: true }).eq('id', ride.id);
      processed += 1;
      if (processed >= maxRides) break;
    }

    if (rides.length < batchSize) break;
  }

  // Newly-processed rides have finalized TSS — refresh the full-history PMC.
  if (processed > 0) {
    try {
      await metrics.calculateFullHistory(userId);
    } catch (e) {
      console.warn('[sync] full-history recalc skipped:', e.message);
    }
  }

  return { processed };
}

// ---------------------------------------------------------------------------
// 4. Sync status
// ---------------------------------------------------------------------------
async function getSyncStatus(userId) {
  const { data, error } = await supabaseAdmin
    .from('strava_connections')
    .select(
      'sync_status, sync_error, initial_sync_completed, initial_sync_progress, initial_sync_total_estimate, last_sync_at, total_activities_synced'
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    return { connected: false, sync_status: 'idle', initial_sync_completed: false, progress_percent: 0 };
  }

  let progressPercent = data.initial_sync_completed ? 100 : 0;
  if (!data.initial_sync_completed && data.initial_sync_total_estimate) {
    progressPercent = Math.min(
      100,
      Math.round((data.initial_sync_progress / data.initial_sync_total_estimate) * 100)
    );
  }

  return {
    connected: true,
    sync_status: data.sync_status,
    sync_error: data.sync_error,
    initial_sync_completed: data.initial_sync_completed,
    initial_sync_progress: data.initial_sync_progress,
    initial_sync_total_estimate: data.initial_sync_total_estimate,
    progress_percent: progressPercent,
    last_sync_at: data.last_sync_at,
    total_activities_synced: data.total_activities_synced,
  };
}

module.exports = {
  syncAllActivities,
  syncNewActivities,
  processUnprocessedRides,
  getSyncStatus,
  toRideRow,
};
