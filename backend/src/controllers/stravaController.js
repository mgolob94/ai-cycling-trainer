const jwt = require('jsonwebtoken');

const strava = require('../services/strava');
const ftp = require('../services/ftp');
const metrics = require('../services/metrics');
const records = require('../services/records');
const stravaSync = require('../services/stravaSync');
const { supabaseAdmin } = require('../db/supabase');
const { invalidateCache, isoWeek } = require('../services/aiCache');
const { verifyToken } = require('../middleware/auth');

const { SUPABASE_JWT_SECRET, APP_OAUTH_SUCCESS_REDIRECT } = process.env;
const STATE_TTL = '10m';

/** Pull the Supabase access token from the bearer header or a `token` query param. */
function extractAccessToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (typeof req.query.token === 'string') return req.query.token;
  return null;
}

/**
 * GET /auth/strava — begin the OAuth flow.
 * Identifies the signed-in user (a top-level browser navigation can't send an
 * Authorization header, so the access token may arrive as ?token=...), signs a
 * short-lived state JWT binding the flow to that user, and redirects to Strava.
 */
async function authorize(req, res, next) {
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Missing access token' });
    }

    let user;
    try {
      user = await verifyToken(accessToken);
    } catch {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Invalid or expired token' });
    }

    // Carry the app's deep link through OAuth (Strava preserves `state`) so the
    // callback can bounce the user back into the app afterwards.
    const returnUrl = typeof req.query.return_url === 'string' ? req.query.return_url : null;
    const state = jwt.sign({ sub: user.id, returnUrl }, SUPABASE_JWT_SECRET, {
      expiresIn: STATE_TTL,
    });

    res.redirect(strava.buildAuthorizeUrl(state));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/strava/callback — Strava redirects here with `code` and our `state`.
 * Verifies state, exchanges the code, and saves encrypted tokens for the user.
 */
async function callback(req, res, next) {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res
        .status(400)
        .json({ success: false, data: null, error: `Strava denied: ${oauthError}` });
    }
    if (!code || !state) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Missing code or state' });
    }

    let userId;
    let returnUrl;
    try {
      ({ sub: userId, returnUrl } = jwt.verify(state, SUPABASE_JWT_SECRET));
    } catch {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Invalid or expired state' });
    }

    const token = await strava.exchangeCodeForToken(code);
    await strava.saveConnection(userId, token);

    // Bounce back into the app: prefer the deep link the app passed through
    // state, then a configured fallback; otherwise just confirm with JSON.
    const target = returnUrl || APP_OAUTH_SUCCESS_REDIRECT;
    if (target) {
      const sep = target.includes('?') ? '&' : '?';
      return res.redirect(`${target}${sep}strava=connected`);
    }
    res.json({ success: true, data: { connected: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/** Trim a raw Strava athlete to the public fields the app displays. */
function publicAthlete(athlete) {
  if (!athlete) return null;
  return {
    id: athlete.id,
    firstname: athlete.firstname,
    lastname: athlete.lastname,
    profile: athlete.profile,
    profile_medium: athlete.profile_medium,
  };
}

/**
 * POST /auth/strava/callback — app-driven OAuth.
 * The app handles the Strava redirect itself (deep link), then sends the
 * authorization code here. Authenticated, so the code is tied to req.user.
 */
async function connectWithCode(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Missing authorization code' });
    }

    const token = await strava.exchangeCodeForToken(code);
    await strava.saveConnection(req.user.id, token);

    res.json({
      success: true,
      data: { connected: true, athlete: publicAthlete(token.athlete) },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/strava/athlete — connection status + profile.
 * Returns { connected: false } (not an error) when the user hasn't linked yet.
 */
async function getAthlete(req, res, next) {
  try {
    const athlete = await strava.fetchAthlete(req.user.id);
    res.json({
      success: true,
      data: { connected: true, athlete: publicAthlete(athlete) },
      error: null,
    });
  } catch (err) {
    if (err.message && err.message.includes('No Strava connection')) {
      return res.json({
        success: true,
        data: { connected: false, athlete: null },
        error: null,
      });
    }
    next(err);
  }
}

/** POST /auth/strava/sync — pull recent rides and upsert them into `rides`. */
async function syncRides(req, res, next) {
  try {
    const rides = await strava.fetchRecentActivities(req.user.id);

    if (rides.length) {
      const { error } = await supabaseAdmin
        .from('rides')
        .upsert(rides, { onConflict: 'strava_id' });
      if (error) throw error;

      // Refresh derived data from the new rides. Best-effort: a failure here
      // (e.g. progress-tracking tables not yet migrated) must not fail the sync.
      await recomputeDerived(req.user.id);
      await invalidateOnSync(req.user.id, rides.length);
    }

    res.json({ success: true, data: { synced: rides.length }, error: null });
  } catch (err) {
    next(err);
  }
}

/** Invalidate AI caches affected by newly synced rides; never throws. */
async function invalidateOnSync(userId, syncedCount) {
  try {
    await invalidateCache(userId, 'weekly_summary', `week_${isoWeek()}`, 'strava_sync');
    await invalidateCache(userId, 'recommendations', null, 'strava_sync');
    if (syncedCount > 5) {
      await invalidateCache(userId, 'trend_analysis', null, 'strava_sync_large');
      await invalidateCache(userId, 'rider_profile', null, 'strava_sync_large');
    }
  } catch (err) {
    console.warn('[sync] cache invalidation skipped:', err.message);
  }
}

/** Recompute FTP + weekly performance metrics after a sync; never throws. */
async function recomputeDerived(userId) {
  // Backfill advanced power metrics (NP/xPower/VI/EF/PDC) for rides missing
  // them, by fetching power streams from Strava. Runs first so weekly TSS can
  // use the freshly-computed normalized power. Capped per run for rate limits.
  try {
    await metrics.recalcAllRidesPower(userId, { onlyMissing: true });
  } catch (err) {
    console.warn('[sync] power recalc skipped:', err.message);
  }
  try {
    await ftp.recalculateForUser(userId, { recordOnlyIfChanged: true });
  } catch (err) {
    console.warn('[sync] FTP recompute skipped:', err.message);
  }
  try {
    await metrics.calculateAndStore(userId);
  } catch (err) {
    console.warn('[sync] metrics recompute skipped:', err.message);
  }
}

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

/**
 * GET /webhooks/strava — Strava webhook subscription validation handshake.
 * Echoes hub.challenge only when hub.verify_token matches our secret.
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN && challenge) {
    return res.json({ 'hub.challenge': challenge });
  }
  return res.status(403).json({ success: false, data: null, error: 'Webhook verification failed' });
}

/** Process a Strava webhook event (runs after the 200 is sent). */
async function processWebhookEvent(event) {
  const { object_type: objectType, object_id: objectId, aspect_type: aspectType, owner_id: ownerId } = event || {};
  if (objectType !== 'activity' || !ownerId || !objectId) return;

  const { data: conn } = await supabaseAdmin
    .from('strava_connections')
    .select('user_id')
    .eq('athlete_id', String(ownerId))
    .maybeSingle();
  if (!conn) return; // unknown athlete
  const userId = conn.user_id;
  const stravaId = String(objectId);

  if (aspectType === 'delete') {
    await supabaseAdmin.from('rides').delete().eq('user_id', userId).eq('strava_id', stravaId);
    return;
  }

  if (aspectType !== 'create') return; // ignore 'update' for now

  const token = await strava.getValidAccessToken(userId);
  const { data: activity } = await axios.get(`${STRAVA_API_BASE}/activities/${objectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!['Ride', 'VirtualRide'].includes(activity.type)) return;

  const row = stravaSync.toRideRow(userId, activity);
  await supabaseAdmin.from('rides').upsert(row, { onConflict: 'strava_id' });

  // Process metrics for this single ride.
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('user_id', userId)
    .eq('strava_id', stravaId)
    .maybeSingle();
  if (ride) {
    try {
      await metrics.recalcRidePower(userId, ride);
    } catch (e) {
      console.warn('[webhook] ride processing failed:', e.message);
    }
    await supabaseAdmin.from('rides').update({ is_processed: true }).eq('id', ride.id);
    // New processed ride → refresh FTP, full-history CTL/ATL/TSB, and records.
    try {
      await ftp.recalculateForUser(userId, { recordOnlyIfChanged: true });
    } catch (e) {
      console.warn('[webhook] FTP recalc skipped:', e.message);
    }
    try {
      await metrics.calculateFullHistory(userId);
    } catch (e) {
      console.warn('[webhook] full-history recalc skipped:', e.message);
    }
    try {
      await records.scanAndUpsert(userId);
    } catch (e) {
      console.warn('[webhook] records recalc skipped:', e.message);
    }
  }

  // Fresh ride → invalidate weekly summary + recommendations.
  await invalidateCache(userId, 'weekly_summary', `week_${isoWeek()}`, 'webhook').catch(() => {});
  await invalidateCache(userId, 'recommendations', null, 'webhook').catch(() => {});

  await supabaseAdmin
    .from('strava_connections')
    .update({ last_activity_sync_at: activity.start_date, last_sync_at: new Date().toISOString() })
    .eq('user_id', userId);
}

/**
 * POST /webhooks/strava — receive activity events. Responds 200 immediately
 * (Strava requires a fast response) and processes asynchronously.
 */
function handleWebhook(req, res) {
  res.status(200).json({ received: true });
  const event = req.body;
  setImmediate(() => {
    processWebhookEvent(event).catch((e) => console.warn('[strava webhook]', e.message));
  });
}

module.exports = {
  authorize,
  callback,
  connectWithCode,
  getAthlete,
  syncRides,
  verifyWebhook,
  handleWebhook,
};
