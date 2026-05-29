const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const { SUPABASE_JWT_SECRET, SUPABASE_URL } = process.env;

if (!SUPABASE_URL) {
  console.warn('[auth] SUPABASE_URL is not set — asymmetric token verification will fail.');
}

// JWKS client for Supabase's asymmetric signing keys (ES256/RS256). Keys are
// cached so we don't refetch on every request.
const jwks = SUPABASE_URL
  ? jwksClient({
      jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    })
  : null;

function getSigningKey(header, callback) {
  if (!jwks) return callback(new Error('JWKS client not configured'));
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/** Verify an asymmetric (ES256/RS256) token against the project's JWKS. */
function verifyAsymmetric(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      { algorithms: ['ES256', 'RS256'], audience: 'authenticated' },
      (err, payload) => (err ? reject(err) : resolve(payload))
    );
  });
}

function normalize(payload) {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    ...payload,
  };
}

/**
 * Verify a Supabase JWT and return a normalized user object. Supports both the
 * legacy HS256 shared-secret tokens and the newer asymmetric signing keys
 * (ES256/RS256), picking the path based on the token header's `alg`. Throws if
 * the token is missing, malformed, or invalid.
 */
async function verifyToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;

  if (alg === 'HS256') {
    return normalize(
      jwt.verify(token, SUPABASE_JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'authenticated',
      })
    );
  }

  return normalize(await verifyAsymmetric(token));
}

/**
 * Express middleware: pull the bearer token from the Authorization header,
 * verify it, and attach the user to `req.user`. Returns 401 on any failure.
 * Responses follow the { success, data, error } convention.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, data: null, error: 'Missing bearer token' });
  }

  try {
    req.user = await verifyToken(token);
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
