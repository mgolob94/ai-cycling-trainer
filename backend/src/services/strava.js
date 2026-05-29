const axios = require('axios');
const { supabaseAdmin } = require('../db/supabase');

const STRAVA_OAUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI } = process.env;

/**
 * Build the Strava OAuth authorize URL. `state` should carry the app user id so
 * the callback can associate the returned tokens with the right account.
 */
function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });
  return `${STRAVA_OAUTH_URL}?${params.toString()}`;
}

/** Exchange an authorization code for access + refresh tokens. */
async function exchangeCodeForToken(code) {
  const { data } = await axios.post(STRAVA_TOKEN_URL, {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });
  return data;
}

/** Refresh an expired access token using a stored refresh token. */
async function refreshAccessToken(refreshToken) {
  const { data } = await axios.post(STRAVA_TOKEN_URL, {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return data;
}

/**
 * Return a valid access token for the given user, refreshing and persisting a
 * new one if the stored token is within 5 minutes of expiry.
 */
async function getValidAccessToken(userId) {
  const { data: conn, error } = await supabaseAdmin
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !conn) {
    throw new Error('No Strava connection found for user');
  }

  const expiresAtMs = new Date(conn.expires_at).getTime();
  const fiveMinutes = 5 * 60 * 1000;

  if (Date.now() < expiresAtMs - fiveMinutes) {
    return conn.access_token;
  }

  const refreshed = await refreshAccessToken(conn.refresh_token);
  await supabaseAdmin
    .from('strava_connections')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}

/** Fetch recent activities for a user and normalize them to the rides schema. */
async function fetchActivities(userId, { perPage = 30, page = 1 } = {}) {
  const accessToken = await getValidAccessToken(userId);

  const { data } = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { per_page: perPage, page },
  });

  return data
    .filter((a) => a.type === 'Ride' || a.type === 'VirtualRide')
    .map((a) => ({
      user_id: userId,
      strava_id: String(a.id),
      distance_km: a.distance / 1000,
      duration_sec: a.moving_time,
      avg_power_w: a.average_watts ?? null,
      avg_heart_rate: a.average_heartrate ?? null,
      elevation_m: a.total_elevation_gain ?? null,
      ride_date: a.start_date_local?.slice(0, 10) ?? null,
    }));
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getValidAccessToken,
  fetchActivities,
};
