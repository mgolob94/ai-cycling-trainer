const { supabaseAdmin } = require('../db/supabase');
const stravaSync = require('../services/stravaSync');

/** POST /sync/initial — kick off the full historical sync (once, after connect). */
async function initial(req, res, next) {
  try {
    const userId = req.user.id;
    const { data: conn } = await supabaseAdmin
      .from('strava_connections')
      .select('initial_sync_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (conn?.initial_sync_completed) {
      return res.json({ success: true, data: { already_completed: true }, error: null });
    }

    // Fire-and-forget so the response returns instantly.
    setImmediate(() => {
      stravaSync.syncAllActivities(userId).catch((e) => console.warn('[sync initial]', e.message));
    });
    res.json({ success: true, data: { started: true, message: 'Sync started in the background' }, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /sync/manual — user-triggered sync (resume initial, or incremental). */
async function manual(req, res, next) {
  try {
    const userId = req.user.id;
    const { data: conn } = await supabaseAdmin
      .from('strava_connections')
      .select('sync_status, initial_sync_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (conn?.sync_status === 'syncing') {
      return res.json({ success: true, data: { status: 'already_syncing' }, error: null });
    }

    setImmediate(() => {
      const task = conn?.initial_sync_completed
        ? stravaSync.syncNewActivities(userId, 'manual')
        : stravaSync.syncAllActivities(userId);
      task.catch((e) => console.warn('[sync manual]', e.message));
    });
    res.json({ success: true, data: { started: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /sync/status — current sync state + last log + new-since-last-sync count. */
async function status(req, res, next) {
  try {
    const userId = req.user.id;
    const base = await stravaSync.getSyncStatus(userId);

    // Activities added since the last sync (e.g. via webhook between syncs).
    let newSince = 0;
    if (base.last_sync_at) {
      const { count } = await supabaseAdmin
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('synced_at', base.last_sync_at);
      newSince = count ?? 0;
    }

    const { data: lastLog } = await supabaseAdmin
      .from('sync_log')
      .select('started_at, completed_at, activities_fetched, sync_type')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Stats for the connected/summary view: total distance + earliest ride date.
    // Distance is summed from the (small) weekly performance_metrics rows rather
    // than scanning every ride.
    const [{ data: weeks }, { data: firstRide }, { count: rideCount }] = await Promise.all([
      supabaseAdmin.from('performance_metrics').select('total_distance_km').eq('user_id', userId),
      supabaseAdmin
        .from('rides')
        .select('ride_date')
        .eq('user_id', userId)
        .not('ride_date', 'is', null)
        .order('ride_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from('rides').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    const totalDistanceKm = (weeks || []).reduce((s, w) => s + (w.total_distance_km || 0), 0);

    res.json({
      success: true,
      data: {
        connected: base.connected ?? false,
        sync_status: base.sync_status,
        sync_error: base.sync_error ?? null,
        initial_sync_completed: base.initial_sync_completed,
        progress_percent: base.progress_percent,
        initial_sync_progress: base.initial_sync_progress ?? 0,
        initial_sync_total_estimate: base.initial_sync_total_estimate ?? null,
        total_activities_synced: base.total_activities_synced ?? 0,
        total_rides: rideCount ?? 0,
        total_distance_km: Math.round(totalDistanceKm),
        first_ride_date: firstRide?.ride_date ?? null,
        last_sync_at: base.last_sync_at ?? null,
        new_activities_since_last_sync: newSince,
        last_sync_log: lastLog ?? null,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /sync/history — the user's last 10 sync runs. */
async function history(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sync_log')
      .select('*')
      .eq('user_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json({ success: true, data: data || [], error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { initial, manual, status, history };
