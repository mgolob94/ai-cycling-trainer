const jwt = require('jsonwebtoken');

const { SUPABASE_JWT_SECRET } = process.env;

if (!SUPABASE_JWT_SECRET) {
  console.warn(
    '[auth] SUPABASE_JWT_SECRET is not set — token verification will reject every request. ' +
      'Copy it from Supabase Dashboard → Settings → API → JWT Settings.'
  );
}

/**
 * Validates the Supabase JWT from the Authorization header and attaches the
 * authenticated user to `req.user`. Verification is done locally by checking the
 * token signature against the project's JWT secret (HS256) — no network call to
 * Supabase. Responses follow the { success, data, error } convention.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, data: null, error: 'Missing bearer token' });
  }

  try {
    // Verifies signature + expiry. Supabase signs auth tokens with HS256 and
    // sets the audience to "authenticated".
    const payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    });

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      ...payload,
    };
    req.accessToken = token;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, data: null, error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
