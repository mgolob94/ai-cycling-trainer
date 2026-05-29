const axios = require('axios');
const { supabaseAdmin } = require('../db/supabase');
const { encrypt, decrypt } = require('./encryption');

const STRAVA_OAUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// Scopes: read basic profile + all activities (needed to import private rides).
const SCOPE = 'read,activity:read_all';
// Refresh slightly ahead of expiry to avoid races on near-expired tokens.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI } = process.env;

/**
 * Build the Strava OAuth authorize URL. `state` is an opaque, signed value that
 * the callback verifies to tie the returned tokens back to the right user.
 */
function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
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
  return data; // { access_token, refresh_token, expires_at, athlete, ... }
}

/** Trade a refresh token for a fresh access token. */
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
 * Persist a Strava token response for a user, encrypting both tokens at rest.
 * Upserts on user_id so re-connecting overwrites the previous connection.
 */
async function saveConnection(userId, token) {
  const { error } = await supabaseAdmin.from('strava_connections').upsert(
    {
      user_id: userId,
      access_token: encrypt(token.access_token),
      refresh_token: encrypt(token.refresh_token),
      expires_at: new Date(token.expires_at * 1000).toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

/** Load and decrypt a user's stored Strava connection. */
async function getConnection(userId) {
  const { data, error } = await supabaseAdmin
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('No Strava connection found for user');
  }

  return {
    accessToken: decrypt(data.access_token),
    refreshToken: decrypt(data.refresh_token),
    expiresAt: new Date(data.expires_at).getTime(),
  };
}

/**
 * Return a valid access token for the user, transparently refreshing and
 * re-persisting it when the stored token is expired (or within the skew window).
 */
async function getValidAccessToken(userId) {
  const conn = await getConnection(userId);

  if (Date.now() < conn.expiresAt - REFRESH_SKEW_MS) {
    return conn.accessToken;
  }

  const refreshed = await refreshAccessToken(conn.refreshToken);
  await saveConnection(userId, refreshed);
  return refreshed.access_token;
}

/** Normalize a raw Strava activity into a row matching the `rides` schema. */
function toRide(userId, activity) {
  return {
    user_id: userId,
    strava_id: String(activity.id),
    distance_km: activity.distance != null ? activity.distance / 1000 : null,
    duration_sec: activity.moving_time ?? null,
    avg_power_w: activity.average_watts ?? null,
    avg_heart_rate: activity.average_heartrate ?? null,
    elevation_m: activity.total_elevation_gain ?? null,
    ride_date: activity.start_date_local?.slice(0, 10) ?? null,
  };
}

/**
 * Fetch the last `weeks` (default 4) of ride activities for a user, paginating
 * through the Strava API. Filters to rides and returns rows shaped for `rides`.
 */
async function fetchRecentActivities(userId, { weeks = 4, perPage = 100 } = {}) {
  const accessToken = await getValidAccessToken(userId);
  const after = Math.floor((Date.now() - weeks * 7 * 24 * 60 * 60 * 1000) / 1000);

  const rides = [];
  let page = 1;

  // Strava returns newest-first within the `after` window; loop until a short
  // (or empty) page signals there's nothing more.
  for (;;) {
    const { data } = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { after, per_page: perPage, page },
    });

    for (const activity of data) {
      if (activity.type === 'Ride' || activity.type === 'VirtualRide') {
        rides.push(toRide(userId, activity));
      }
    }

    if (data.length < perPage) break;
    page += 1;
  }

  return rides;
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  saveConnection,
  getConnection,
  getValidAccessToken,
  fetchRecentActivities,
};
