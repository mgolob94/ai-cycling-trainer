const jwt = require('jsonwebtoken');

const { SUPABASE_JWT_SECRET } = process.env;

if (!SUPABASE_JWT_SECRET) {
  console.warn(
    '[auth] SUPABASE_JWT_SECRET is not set — token verification will reject every request. ' +
      'Copy it from Supabase Dashboard → Settings → API → JWT Settings.'
  );
}

/**
 * Verify a Supabase JWT locally (HS256, audience "authenticated") and return a
 * normalized user object. Throws if the token is missing, malformed, or expired.
 */
function verifyToken(token) {
  const payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
    algorithms: ['HS256'],
    audience: 'authenticated',
  });
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    ...payload,
  };
}

/**
 * Express middleware: pull the bearer token from the Authorization header,
 * verify it, and attach the user to `req.user`. Returns 401 on any failure.
 * Responses follow the { success, data, error } convention.
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
    req.user = verifyToken(token);
    req.accessToken = token;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, data: null, error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
module.exports.verifyToken = verifyToken;
