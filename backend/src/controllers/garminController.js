const garmin = require('../services/garmin');
const { verifyToken } = require('../middleware/auth');

/**
 * GET /integrations/garmin/auth?token=<jwt>&return_url=...
 * Verifies the user (token query param, like the Strava flow), starts OAuth 1.0a,
 * and redirects to Garmin's authorize page.
 */
async function auth(req, res, next) {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (!token) return res.status(401).json({ success: false, data: null, error: 'Missing token' });

    let user;
    try {
      user = await verifyToken(token);
    } catch {
      return res.status(401).json({ success: false, data: null, error: 'Invalid token' });
    }

    const returnUrl = typeof req.query.return_url === 'string' ? req.query.return_url : null;
    const authorizeUrl = await garmin.startAuth(user.id, returnUrl);
    res.redirect(authorizeUrl);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /integrations/garmin/callback?oauth_token=...&oauth_verifier=...
 * Exchanges for the permanent access token and stores the connection.
 */
async function callback(req, res, next) {
  try {
    const oauthToken = req.query.oauth_token;
    const verifier = req.query.oauth_verifier;
    if (!oauthToken || !verifier) {
      return res.status(400).json({ success: false, data: null, error: 'Missing oauth_token/oauth_verifier' });
    }

    const { returnUrl } = await garmin.completeAuth(String(oauthToken), String(verifier));

    if (returnUrl) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      return res.redirect(`${returnUrl}${sep}garmin=connected`);
    }
    res.json({ success: true, data: { connected: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /integrations/garmin/sync — manual sync for the signed-in user. */
async function sync(req, res, next) {
  try {
    const result = await garmin.syncAll(req.user.id);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { auth, callback, sync };
