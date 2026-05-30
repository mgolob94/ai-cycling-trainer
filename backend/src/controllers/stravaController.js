const jwt = require('jsonwebtoken');

const strava = require('../services/strava');
const ftp = require('../services/ftp');
const metrics = require('../services/metrics');
const { supabaseAdmin } = require('../db/supabase');
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
    }

    res.json({ success: true, data: { synced: rides.length }, error: null });
  } catch (err) {
    next(err);
  }
}

/** Recompute FTP + weekly performance metrics after a sync; never throws. */
async function recomputeDerived(userId) {
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

/** Strava webhook subscription validation handshake. */
function verifyWebhook(req, res) {
  const challenge = req.query['hub.challenge'];
  if (challenge) {
    return res.json({ 'hub.challenge': challenge });
  }
  res.status(400).json({ success: false, data: null, error: 'Missing challenge' });
}

/** Receive a push event from Strava (new activity, etc.). */
async function handleWebhook(req, res, next) {
  try {
    // TODO: enqueue a sync for req.body.owner_id / object_id.
    console.log('[strava webhook]', JSON.stringify(req.body));
    res.status(200).json({ success: true, data: { received: true }, error: null });
  } catch (err) {
    next(err);
  }
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
