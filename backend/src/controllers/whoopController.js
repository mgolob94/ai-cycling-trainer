const jwt = require('jsonwebtoken');

const whoop = require('../services/whoop');
const { verifyToken } = require('../middleware/auth');

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

/**
 * GET /integrations/whoop/auth?token=<jwt>&return_url=...
 * Verifies the user, signs a short-lived state (sub + returnUrl), and redirects
 * to Whoop's OAuth consent page.
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
    const state = jwt.sign({ sub: user.id, returnUrl }, SUPABASE_JWT_SECRET, { expiresIn: '10m' });
    res.redirect(whoop.buildAuthorizeUrl(state));
  } catch (err) {
    next(err);
  }
}

/** GET /integrations/whoop/callback?code=...&state=... */
async function callback(req, res, next) {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.status(400).json({ success: false, data: null, error: String(oauthError) });
    if (!code || !state) {
      return res.status(400).json({ success: false, data: null, error: 'Missing code/state' });
    }

    let userId;
    let returnUrl = null;
    try {
      ({ sub: userId, returnUrl } = jwt.verify(String(state), SUPABASE_JWT_SECRET));
    } catch {
      return res.status(400).json({ success: false, data: null, error: 'Invalid state' });
    }

    const token = await whoop.exchangeCodeForToken(String(code));
    await whoop.saveConnection(userId, token);

    if (returnUrl) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      return res.redirect(`${returnUrl}${sep}whoop=connected`);
    }
    res.json({ success: true, data: { connected: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /integrations/whoop/sync — manual sync for the signed-in user. */
async function sync(req, res, next) {
  try {
    const result = await whoop.syncAll(req.user.id);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { auth, callback, sync };
