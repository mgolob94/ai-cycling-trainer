const axios = require('axios');

const { supabaseAdmin } = require('../db/supabase');
const { encrypt, decrypt } = require('./encryption');

// Whoop integration (OAuth 2.0). Tokens stored encrypted in source_connections
// (source = 'whoop'); expiry kept in config_json.expires_at and refreshed before
// use. Whoop exposes its OWN recovery score, which our recoveryScore service
// prefers when this source is connected (via hrv_readings.raw_data.recovery_score).
//
// NOTE: hosts/paths follow Whoop's v1 developer API but vary by version — all
// overridable via env. Unverified end-to-end (no Whoop test credentials).

const SOURCE = 'whoop';

const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
const REDIRECT_URI = process.env.WHOOP_REDIRECT_URI;
const AUTH_URL = process.env.WHOOP_AUTH_URL || 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = process.env.WHOOP_TOKEN_URL || 'https://api.prod.whoop.com/oauth/oauth2/token';
const API_BASE = process.env.WHOOP_API_BASE || 'https://api.prod.whoop.com/developer';

const SCOPE = 'offline read:recovery read:sleep read:cycles read:profile';
const REFRESH_SKEW_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// OAuth 2.0
// ---------------------------------------------------------------------------
function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const { data } = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data; // { access_token, refresh_token, expires_in, scope, token_type }
}

async function refreshAccessToken(refreshToken) {
  const { data } = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: SCOPE,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data;
}

/** Persist a Whoop token response for a user (encrypted). */
async function saveConnection(userId, token) {
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
  const row = {
    user_id: userId,
    source: SOURCE,
    is_connected: true,
    access_token: encrypt(token.access_token),
    config_json: { expires_at: expiresAt, scope: token.scope ?? SCOPE },
  };
  // Keep the existing refresh token if a refresh response omits it.
  if (token.refresh_token) row.refresh_token = encrypt(token.refresh_token);
  await supabaseAdmin.from('source_connections').upsert(row, { onConflict: 'user_id,source' });
}

async function getConnection(userId) {
  const { data, error } = await supabaseAdmin
    .from('source_connections')
    .select('access_token, refresh_token, is_connected, config_json')
    .eq('user_id', userId)
    .eq('source', SOURCE)
    .maybeSingle();
  if (error || !data || !data.is_connected || !data.access_token) throw new Error('No Whoop connection for user');
  return {
    accessToken: decrypt(data.access_token),
    refreshToken: data.refresh_token ? decrypt(data.refresh_token) : null,
    expiresAt: data.config_json?.expires_at ? new Date(data.config_json.expires_at).getTime() : 0,
  };
}

/** Valid access token, refreshing + re-persisting when near expiry. */
async function getValidAccessToken(userId) {
  const conn = await getConnection(userId);
  if (Date.now() < conn.expiresAt - REFRESH_SKEW_MS) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken; // can't refresh — try as-is
  const refreshed = await refreshAccessToken(conn.refreshToken);
  await saveConnection(userId, refreshed);
  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Paginated GET (Whoop returns { records, next_token })
// ---------------------------------------------------------------------------
async function getAllRecords(userId, path, days, extra = {}) {
  const token = await getValidAccessToken(userId);
  const start = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const end = new Date().toISOString();

  const records = [];
  let nextToken;
  for (let page = 0; page < 20; page += 1) {
    const params = { start, end, limit: 25, ...extra };
    if (nextToken) params.nextToken = nextToken;
    const { data } = await axios.get(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    records.push(...(data.records ?? []));
    nextToken = data.next_token;
    if (!nextToken) break;
  }
  return records;
}

/** Merge a patch into a day's recovery_scores.raw_data without clobbering it. */
async function mergeRecoveryRaw(userId, date, patch) {
  const { data: existing } = await supabaseAdmin
    .from('recovery_scores')
    .select('raw_data')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  const raw = { ...(existing?.raw_data || {}), ...patch };
  await supabaseAdmin
    .from('recovery_scores')
    .upsert({ user_id: userId, date, raw_data: raw }, { onConflict: 'user_id,date' });
}

// ---------------------------------------------------------------------------
// 2. Recovery → hrv_readings (+ recovery_scores.raw_data)
// ---------------------------------------------------------------------------
async function fetchRecoveryData(userId, days = 30) {
  const records = await getAllRecords(userId, '/v1/recovery', days);
  const rows = [];
  for (const r of records) {
    const s = r.score ?? {};
    const recordedAt = r.created_at ?? r.updated_at;
    if (!recordedAt) continue;
    rows.push({
      user_id: userId,
      recorded_at: recordedAt,
      hrv_ms: s.hrv_rmssd_milli != null ? Math.round(s.hrv_rmssd_milli * 10) / 10 : null,
      resting_hr: s.resting_heart_rate ?? null,
      source: SOURCE,
      // recoveryScore prefers `recovery_score` here when Whoop is connected.
      raw_data: { recovery_score: s.recovery_score ?? null, user_calibrating: s.user_calibrating ?? null },
    });
  }

  let synced = 0;
  if (rows.length) {
    const { error, count } = await supabaseAdmin
      .from('hrv_readings')
      .upsert(rows, { onConflict: 'user_id,recorded_at,source', count: 'exact' });
    if (!error) synced = count ?? rows.length;
    // Also record Whoop's own recovery score per day as an input/cross-check.
    for (const row of rows) {
      if (row.raw_data.recovery_score != null) {
        await mergeRecoveryRaw(userId, row.recorded_at.slice(0, 10), {
          whoop_recovery_score: row.raw_data.recovery_score,
        });
      }
    }
  }
  return synced;
}

// ---------------------------------------------------------------------------
// 3. Sleep → sleep_sessions
// ---------------------------------------------------------------------------
async function fetchSleepData(userId, days = 30) {
  // Whoop's sleep activities live under /v1/activity/sleep.
  const records = await getAllRecords(userId, '/v1/activity/sleep', days);
  const toMin = (milli) => (milli != null ? Math.round(milli / 60000) : null);
  const rows = [];
  for (const r of records) {
    if (r.nap) continue; // only main sleeps
    const start = r.start;
    if (!start) continue;
    const stage = r.score?.stage_summary ?? {};
    const deep = toMin(stage.total_slow_wave_sleep_time_milli);
    const rem = toMin(stage.total_rem_sleep_time_milli);
    const light = toMin(stage.total_light_sleep_time_milli);
    const awake = toMin(stage.total_awake_time_milli);
    rows.push({
      user_id: userId,
      date: start.slice(0, 10),
      sleep_start: start,
      sleep_end: r.end ?? null,
      duration_min: (deep ?? 0) + (rem ?? 0) + (light ?? 0),
      deep_min: deep,
      rem_min: rem,
      light_min: light,
      awake_min: awake,
      sleep_score: r.score?.sleep_performance_percentage ?? null,
      source: SOURCE,
      raw_data: r,
    });
  }

  let synced = 0;
  if (rows.length) {
    const { error, count } = await supabaseAdmin
      .from('sleep_sessions')
      .upsert(rows, { onConflict: 'user_id,date,source', count: 'exact' });
    if (!error) synced = count ?? rows.length;
  }
  return synced;
}

// ---------------------------------------------------------------------------
// 4. Strain (Whoop cycle, 0–21) → recovery_scores.raw_data (TSS cross-check)
// ---------------------------------------------------------------------------
async function fetchStrainData(userId, days = 30) {
  const records = await getAllRecords(userId, '/v1/cycle', days);
  let synced = 0;
  for (const r of records) {
    const strain = r.score?.strain;
    const start = r.start;
    if (strain == null || !start) continue;
    await mergeRecoveryRaw(userId, start.slice(0, 10), { whoop_strain: Math.round(strain * 10) / 10 });
    synced += 1;
  }
  return synced;
}

/** Manual full sync. */
async function syncAll(userId) {
  const [recovery, sleep, strain] = await Promise.all([
    fetchRecoveryData(userId, 30),
    fetchSleepData(userId, 30),
    fetchStrainData(userId, 30),
  ]);
  await supabaseAdmin
    .from('source_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('source', SOURCE);
  return { recovery_synced: recovery, sleep_synced: sleep, strain_synced: strain };
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  saveConnection,
  getValidAccessToken,
  fetchRecoveryData,
  fetchSleepData,
  fetchStrainData,
  syncAll,
};
