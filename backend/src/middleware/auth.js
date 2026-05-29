const { supabase } = require('../db/supabase');

/**
 * Validates the Supabase JWT from the Authorization header and attaches the
 * authenticated user to `req.user`. Responses follow the { success, data, error }
 * convention.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Missing bearer token' });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Invalid or expired token' });
    }

    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
