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

    res.json({
      success: true,
      data: {
        sync_status: base.sync_status,
        initial_sync_completed: base.initial_sync_completed,
        progress_percent: base.progress_percent,
        total_activities_synced: base.total_activities_synced ?? 0,
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
