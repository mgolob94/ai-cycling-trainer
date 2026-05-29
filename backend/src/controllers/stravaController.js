const strava = require('../services/strava');
const { supabaseAdmin } = require('../db/supabase');

/** Redirect the user to Strava's OAuth consent screen. */
async function authorize(req, res, next) {
  try {
    const url = strava.buildAuthorizeUrl(req.user.id);
    res.json({ success: true, data: { url }, error: null });
  } catch (err) {
    next(err);
  }
}

/** OAuth callback — exchange the code and store tokens. `state` carries user id. */
async function callback(req, res, next) {
  try {
    const { code, state: userId } = req.query;
    if (!code || !userId) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Missing code or state' });
    }

    const token = await strava.exchangeCodeForToken(code);

    await supabaseAdmin.from('strava_connections').upsert(
      {
        user_id: userId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(token.expires_at * 1000).toISOString(),
      },
      { onConflict: 'user_id' }
    );

    res.json({ success: true, data: { connected: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/** Pull recent activities from Strava and upsert them into rides. */
async function syncRides(req, res, next) {
  try {
    const rides = await strava.fetchActivities(req.user.id);

    if (rides.length) {
      await supabaseAdmin
        .from('rides')
        .upsert(rides, { onConflict: 'strava_id' });
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
