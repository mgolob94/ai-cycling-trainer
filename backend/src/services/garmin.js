const crypto = require('crypto');
const axios = require('axios');

const { supabaseAdmin } = require('../db/supabase');
const { encrypt, decrypt } = require('./encryption');

// Garmin Connect / Health API integration. Garmin uses OAuth 1.0a (HMAC-SHA1)
// and the access tokens do not expire, so we store them permanently (encrypted)
// in source_connections (source = 'garmin').
//
// NOTE: endpoint hosts and response field names follow Garmin's Health API docs
// but vary by API version / partner approval — confirm against your Garmin
// developer program app. All hosts are overridable via env.

const SOURCE = 'garmin';

const CONSUMER_KEY = process.env.GARMIN_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.GARMIN_CONSUMER_SECRET;
const CALLBACK_URL = process.env.GARMIN_REDIRECT_URI;

const REQUEST_TOKEN_URL =
  process.env.GARMIN_REQUEST_TOKEN_URL || 'https://connectapi.garmin.com/oauth-service/oauth/request_token';
const AUTHORIZE_URL = process.env.GARMIN_AUTHORIZE_URL || 'https://connect.garmin.com/oauthConfirm';
const ACCESS_TOKEN_URL =
  process.env.GARMIN_ACCESS_TOKEN_URL || 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
const API_BASE = process.env.GARMIN_API_BASE || 'https://apis.garmin.com';

// ---------------------------------------------------------------------------
// OAuth 1.0a signing
// ---------------------------------------------------------------------------
function rfc3986(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function baseOAuthParams(extra = {}) {
  return {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extra,
  };
}

/** OAuth 1.0a HMAC-SHA1 signature over method + base URL + sorted params. */
function sign(method, baseUrl, params, tokenSecret = '') {
  const normalized = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join('&');
  const base = [method.toUpperCase(), rfc3986(baseUrl), rfc3986(normalized)].join('&');
  const key = `${rfc3986(CONSUMER_SECRET)}&${rfc3986(tokenSecret)}`;
  return crypto.createHmac('sha1', key).update(base).digest('base64');
}

/** Build an `Authorization: OAuth ...` header from oauth_* params. */
function authHeader(oauthParams) {
  return (
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(oauthParams[k])}"`)
      .join(', ')
  );
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------
/** Step 1: obtain a temporary request token (+ secret). */
async function getRequestToken() {
  const oauth = baseOAuthParams({ oauth_callback: CALLBACK_URL });
  oauth.oauth_signature = sign('POST', REQUEST_TOKEN_URL, oauth, '');
  const { data } = await axios.post(REQUEST_TOKEN_URL, null, { headers: { Authorization: authHeader(oauth) } });
  const p = new URLSearchParams(data);
  return { token: p.get('oauth_token'), tokenSecret: p.get('oauth_token_secret') };
}

function buildAuthorizeUrl(requestToken) {
  return `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(requestToken)}`;
}

/** Step 3: exchange the verified request token for a permanent access token. */
async function getAccessToken(requestToken, requestTokenSecret, verifier) {
  const oauth = baseOAuthParams({ oauth_token: requestToken, oauth_verifier: verifier });
  oauth.oauth_signature = sign('POST', ACCESS_TOKEN_URL, oauth, requestTokenSecret);
  const { data } = await axios.post(ACCESS_TOKEN_URL, null, { headers: { Authorization: authHeader(oauth) } });
  const p = new URLSearchParams(data);
  return { token: p.get('oauth_token'), tokenSecret: p.get('oauth_token_secret') };
}

/**
 * Begin the connect flow for a user: get a request token, stash its secret in
 * source_connections.config_json (keyed by the request token so the callback
 * can find it), and return the Garmin authorize URL.
 */
async function startAuth(userId, returnUrl = null) {
  const { token, tokenSecret } = await getRequestToken();
  await supabaseAdmin.from('source_connections').upsert(
    {
      user_id: userId,
      source: SOURCE,
      is_connected: false,
      config_json: { request_token: token, request_token_secret: encrypt(tokenSecret), return_url: returnUrl },
    },
    { onConflict: 'user_id,source' }
  );
  return buildAuthorizeUrl(token);
}

/**
 * Complete the flow: look up the pending connection by request token, exchange
 * for the permanent access token, and store it (encrypted). Returns userId.
 */
async function completeAuth(requestToken, verifier) {
  const { data: pending } = await supabaseAdmin
    .from('source_connections')
    .select('user_id, config_json')
    .eq('source', SOURCE)
    .filter('config_json->>request_token', 'eq', requestToken)
    .maybeSingle();
  if (!pending) throw new Error('No pending Garmin authorization for that request token');

  const requestTokenSecret = decrypt(pending.config_json.request_token_secret);
  const returnUrl = pending.config_json.return_url ?? null;
  const access = await getAccessToken(requestToken, requestTokenSecret, verifier);

  await supabaseAdmin.from('source_connections').upsert(
    {
      user_id: pending.user_id,
      source: SOURCE,
      is_connected: true,
      access_token: encrypt(access.token),
      refresh_token: encrypt(access.tokenSecret), // OAuth1 token secret (no refresh concept)
      last_sync_at: null,
      config_json: {},
    },
    { onConflict: 'user_id,source' }
  );
  return { userId: pending.user_id, returnUrl };
}

/** Load + decrypt a user's Garmin access token + token secret. */
async function getConnection(userId) {
  const { data, error } = await supabaseAdmin
    .from('source_connections')
    .select('access_token, refresh_token, is_connected')
    .eq('user_id', userId)
    .eq('source', SOURCE)
    .maybeSingle();
  if (error || !data || !data.is_connected || !data.access_token) {
    throw new Error('No Garmin connection for user');
  }
  return { token: decrypt(data.access_token), tokenSecret: decrypt(data.refresh_token) };
}

/** Signed GET against the Garmin Health API. */
async function signedGet(userId, path, query = {}) {
  const conn = await getConnection(userId);
  const url = `${API_BASE}${path}`;
  const oauth = baseOAuthParams({ oauth_token: conn.token });
  // The signature covers oauth params + query params together.
  const signature = sign('GET', url, { ...oauth, ...stringifyQuery(query) }, conn.tokenSecret);
  const header = authHeader({ ...oauth, oauth_signature: signature });
  const { data } = await axios.get(url, { headers: { Authorization: header }, params: query });
  return data;
}

function stringifyQuery(query) {
  const out = {};
  for (const [k, v] of Object.entries(query)) out[k] = String(v);
  return out;
}

// ---------------------------------------------------------------------------
// Data fetch — Garmin enforces ≤24h windows on these summaries, so we loop one
// day at a time over the requested range.
// ---------------------------------------------------------------------------
function dayWindows(days) {
  const windows = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < days; i += 1) {
    const end = now - i * 86400;
    windows.push({ start: end - 86400, end });
  }
  return windows;
}

/** 2. HRV (+ resting HR / stress proxy from dailies) → hrv_readings. */
async function fetchHRVData(userId, days = 30) {
  const rows = [];
  for (const { start, end } of dayWindows(days)) {
    const params = { uploadStartTimeInSeconds: start, uploadEndTimeInSeconds: end };
    let hrvSamples = [];
    try {
      hrvSamples = (await signedGet(userId, '/wellness-api/rest/hrv', params)) || [];
    } catch {
      hrvSamples = [];
    }
    let dailies = [];
    try {
      dailies = (await signedGet(userId, '/wellness-api/rest/dailies', params)) || [];
    } catch {
      dailies = [];
    }

    for (const h of Array.isArray(hrvSamples) ? hrvSamples : []) {
      // lastNightAvg is the overnight HRV (ms); pair with that day's dailies.
      const hrvMs = h.lastNightAvg ?? h.hrvSummary?.lastNightAvg ?? null;
      const daily = dailies.find?.((d) => d.calendarDate === h.calendarDate) ?? dailies[0];
      const recordedAt = `${h.calendarDate ?? new Date(end * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
      if (hrvMs == null && !daily) continue;
      rows.push({
        user_id: userId,
        recorded_at: recordedAt,
        hrv_ms: hrvMs != null ? Math.round(hrvMs * 10) / 10 : null,
        resting_hr: daily?.restingHeartRateInBeatsPerMinute ?? null,
        source: SOURCE,
        // Stress is an inverse HRV proxy — kept in raw_data rather than as hrv_ms
        // so it doesn't skew the HRV baseline.
        raw_data: { averageStressLevel: daily?.averageStressLevel ?? null, garmin: true },
      });
    }
  }

  let synced = 0;
  if (rows.length) {
    const { error, count } = await supabaseAdmin
      .from('hrv_readings')
      .upsert(rows, { onConflict: 'user_id,recorded_at,source', count: 'exact' });
    if (!error) synced = count ?? rows.length;
  }
  return synced;
}

/** 3. Sleep → sleep_sessions. */
async function fetchSleepData(userId, days = 30) {
  const rows = [];
  for (const { start, end } of dayWindows(days)) {
    let sleeps = [];
    try {
      sleeps =
        (await signedGet(userId, '/wellness-api/rest/sleeps', {
          uploadStartTimeInSeconds: start,
          uploadEndTimeInSeconds: end,
        })) || [];
    } catch {
      sleeps = [];
    }
    for (const s of Array.isArray(sleeps) ? sleeps : []) {
      const date = s.calendarDate;
      if (!date) continue;
      const toMin = (sec) => (sec != null ? Math.round(sec / 60) : null);
      rows.push({
        user_id: userId,
        date,
        duration_min: toMin(s.sleepTimeSeconds),
        deep_min: toMin(s.deepSleepSeconds),
        rem_min: toMin(s.remSleepSeconds),
        light_min: toMin(s.lightSleepSeconds),
        awake_min: toMin(s.awakeSleepSeconds),
        sleep_score: s.sleepScores?.overall?.value ?? s.overallSleepScore ?? null,
        source: SOURCE,
        raw_data: s,
      });
    }
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

/** 4. Body Battery (Garmin's 0–100 recovery metric) → recovery_scores.raw_data. */
async function fetchBodyBattery(userId, days = 7) {
  let synced = 0;
  for (const { start, end } of dayWindows(days)) {
    let dailies = [];
    try {
      dailies = (await signedGet(userId, '/wellness-api/rest/dailies', {
        uploadStartTimeInSeconds: start,
        uploadEndTimeInSeconds: end,
      })) || [];
    } catch {
      dailies = [];
    }
    for (const d of Array.isArray(dailies) ? dailies : []) {
      const date = d.calendarDate;
      const values = d.bodyBatteryValuesArray; // [[ts, value], ...] when present
      const bodyBattery =
        d.maxBodyBattery ??
        (Array.isArray(values) && values.length ? Math.max(...values.map((v) => v[1] ?? 0)) : null);
      if (!date || bodyBattery == null) continue;

      // Merge into the day's recovery_scores row without clobbering the score.
      const { data: existing } = await supabaseAdmin
        .from('recovery_scores')
        .select('raw_data')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      const raw = { ...(existing?.raw_data || {}), garmin_body_battery: bodyBattery };
      const { error } = await supabaseAdmin
        .from('recovery_scores')
        .upsert({ user_id: userId, date, raw_data: raw }, { onConflict: 'user_id,date' });
      if (!error) synced += 1;
    }
  }
  return synced;
}

/** Manual full sync: HRV + sleep + body battery, then mark last_sync_at. */
async function syncAll(userId) {
  const [hrv, sleep, bodyBattery] = await Promise.all([
    fetchHRVData(userId, 30),
    fetchSleepData(userId, 30),
    fetchBodyBattery(userId, 7),
  ]);
  await supabaseAdmin
    .from('source_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('source', SOURCE);
  return { hrv_synced: hrv, sleep_synced: sleep, body_battery_synced: bodyBattery };
}

module.exports = {
  startAuth,
  completeAuth,
  fetchHRVData,
  fetchSleepData,
  fetchBodyBattery,
  syncAll,
  // exported for testing
  sign,
  rfc3986,
};
