const jwt = require('jsonwebtoken');

const strava = require('../services/strava');
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
function authorize(req, res, next) {
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Missing access token' });
    }

    let user;
    try {
      user = verifyToken(accessToken);
    } catch {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Invalid or expired token' });
    }

    const state = jwt.sign({ sub: user.id }, SUPABASE_JWT_SECRET, {
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
    try {
      ({ sub: userId } = jwt.verify(state, SUPABASE_JWT_SECRET));
    } catch {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Invalid or expired state' });
    }

    const token = await strava.exchangeCodeForToken(code);
    await strava.saveConnection(userId, token);

    // Bounce back into the app if a deep link is configured; otherwise confirm.
    if (APP_OAUTH_SUCCESS_REDIRECT) {
      return res.redirect(APP_OAUTH_SUCCESS_REDIRECT);
    }
    res.json({ success: true, data: { connected: true }, error: null });
  } catch (err) {
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
    }

    res.json({ success: true, data: { synced: rides.length }, error: null });
  } catch (err) {
    next(err);
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
  syncRides,
  verifyWebhook,
  handleWebhook,
};
