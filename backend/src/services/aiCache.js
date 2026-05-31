const crypto = require('crypto');
const { supabaseAdmin } = require('../db/supabase');
const { PLAN_LIMITS } = require('../config/subscriptionLimits');

const TABLE = 'ai_analysis_cache';

// Analysis types gated behind a plan capability.
const PLAN_GATED = {
  ride_analysis: 'can_refresh_ride_analysis',
  periodization: 'can_refresh_periodization',
};

// Default time-to-live per analysis type, in hours.
const TTL_DEFAULTS = {
  weekly_summary: 168, // 1 week
  ride_analysis: 8760, // 1 year — ride data never changes
  trend_analysis: 720, // 1 month
  recommendations: 48, // 2 days
  periodization: 336, // 2 weeks
  rider_profile: 336, // 2 weeks
  ftp_insight: 8760, // 1 year — FTP test data never changes
  hrv_trend: 48, // 2 days
  weekly_plan: 168, // 1 week
  monthly_review: 720, // 1 month
  midweek_checkin: 72, // 3 days
  endofweek_checkin: 168, // 1 week
  goal_insight: 168, // 1 week
};

const FALLBACK_TTL = 168;

// In-process hit/miss accounting per user (cache stats). Resets on restart;
// the durable counts (total cached, oldest/newest) come from the DB.
const runtimeStats = new Map(); // userId -> { hits, misses, tokensSaved }

function bump(userId, field, amount = 1) {
  const s = runtimeStats.get(userId) || { hits: 0, misses: 0, tokensSaved: 0 };
  s[field] += amount;
  runtimeStats.set(userId, s);
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/** ISO week key, e.g. '2026-W22'. */
function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Year-month key, e.g. '2026-05'. */
function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Look up a valid, non-expired cache entry.
 * Returns { hit: true, data, generated_at, tokens_used } or { hit: false }.
 */
async function getCached(userId, analysisType, cacheKey) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('content_json, generated_at, tokens_used')
    .eq('user_id', userId)
    .eq('analysis_type', analysisType)
    .eq('cache_key', cacheKey)
    .eq('is_valid', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) return { hit: false };
  if (!data) {
    bump(userId, 'misses');
    return { hit: false };
  }

  bump(userId, 'hits');
  bump(userId, 'tokensSaved', data.tokens_used || 0);
  return {
    hit: true,
    data: data.content_json,
    generated_at: data.generated_at,
    tokens_used: data.tokens_used,
  };
}

/**
 * Upsert a cache entry (conflict on user_id, analysis_type, cache_key).
 * ttlHours defaults to TTL_DEFAULTS[analysisType]. An explicit inputHash may be
 * passed; otherwise it's derived from the analysis type + cache key.
 */
async function saveCache(
  userId,
  analysisType,
  cacheKey,
  contentJson,
  tokensUsed = null,
  modelUsed = null,
  ttlHours,
  inputHash = null
) {
  const baseTtl = ttlHours ?? TTL_DEFAULTS[analysisType] ?? FALLBACK_TTL;
  const now = Date.now();

  // Plan at generation time (users.subscription_plan may not exist → 'free').
  let plan = 'free';
  try {
    const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
    plan = user?.subscription_plan ?? 'free';
  } catch {
    // keep default
  }

  // Higher tiers get fresher analyses (shorter TTL) via the plan multiplier.
  const multiplier = (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free).cache_ttl_multiplier ?? 1;
  const ttl = baseTtl * multiplier;

  const row = {
    user_id: userId,
    analysis_type: analysisType,
    cache_key: cacheKey,
    content_json: contentJson,
    input_hash: inputHash ?? md5(`${analysisType}:${cacheKey}`),
    model_used: modelUsed,
    tokens_used: tokensUsed,
    generated_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl * 3600 * 1000).toISOString(),
    is_valid: true,
    subscription_plan: plan,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,analysis_type,cache_key' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark cache entries invalid.
 *   - analysisType null  → all of the user's entries
 *   - cacheKey provided  → just that entry of the given type
 *   - otherwise          → every entry of that type for the user
 * `reason` is logged for debugging. Returns { invalidated: count }.
 */
async function invalidateCache(userId, analysisType = null, cacheKey = null, reason = null) {
  let query = supabaseAdmin.from(TABLE).update({ is_valid: false }).eq('user_id', userId);
  if (analysisType) query = query.eq('analysis_type', analysisType);
  if (cacheKey) query = query.eq('cache_key', cacheKey);

  const { data, error } = await query.select('id');
  if (error) throw error;
  console.log(
    `[CACHE INVALIDATED] type=${analysisType ?? 'ALL'} user=${userId} reason=${reason ?? 'n/a'}`
  );
  return { invalidated: (data || []).length };
}

/**
 * Cache usage stats for a user. total_analyses_cached / oldest / newest come
 * from the DB; hit rate and tokens saved are accumulated in-process since start.
 */
async function getCacheStats(userId) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('generated_at')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('generated_at', { ascending: true });
  if (error) throw error;

  const rows = data || [];
  const s = runtimeStats.get(userId) || { hits: 0, misses: 0, tokensSaved: 0 };
  const totalRequests = s.hits + s.misses;

  return {
    total_analyses_cached: rows.length,
    total_tokens_saved: s.tokensSaved,
    cache_hit_rate_percent: totalRequests ? Math.round((s.hits / totalRequests) * 1000) / 10 : 0,
    oldest_entry: rows.length ? rows[0].generated_at : null,
    newest_entry: rows.length ? rows[rows.length - 1].generated_at : null,
  };
}

/** First day of next month (UTC) as ISO — when the monthly refresh count resets. */
function firstDayOfNextMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/** Cheapest plan that allows a gated capability. */
function requiredPlanFor(capability) {
  for (const plan of ['free', 'basic', 'pro']) {
    if (PLAN_LIMITS[plan][capability]) return plan;
  }
  return 'pro';
}

/**
 * Whether a user may trigger a manual refresh of analysisType, given their plan
 * and monthly usage. (Placeholder enforcement — billing not implemented.)
 *   - over the monthly limit  → { allowed:false, reason:'limit_reached', limit, used }
 *   - type not allowed on plan → { allowed:false, reason:'plan_required', required_plan }
 *   - otherwise               → { allowed:true }
 * Pass analysisType=null to check the limit without the per-type plan gate.
 *
 * TODO: Wire this into DELETE /cache/invalidate when billing is implemented.
 */
async function checkRefreshAllowed(userId, analysisType) {
  let user = {};
  try {
    const { data } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
    user = data || {};
  } catch {
    // treat as free / no usage
  }

  const plan = user.subscription_plan ?? 'free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  // Usage resets at the start of each month.
  const resetAt = user.ai_refreshes_reset_at ? new Date(user.ai_refreshes_reset_at) : null;
  const used = resetAt && Date.now() < resetAt.getTime() ? user.ai_refreshes_used_this_month ?? 0 : 0;

  if (used >= limits.ai_refreshes_per_month) {
    return { allowed: false, reason: 'limit_reached', limit: limits.ai_refreshes_per_month, used };
  }

  const capability = PLAN_GATED[analysisType];
  if (capability && !limits[capability]) {
    return { allowed: false, reason: 'plan_required', required_plan: requiredPlanFor(capability) };
  }

  return { allowed: true };
}

/** Count a refresh against the user's monthly allowance (resets monthly). */
async function incrementRefreshUsed(userId) {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('ai_refreshes_used_this_month, ai_refreshes_reset_at')
    .eq('id', userId)
    .single();

  const resetAt = user?.ai_refreshes_reset_at ? new Date(user.ai_refreshes_reset_at) : null;
  const expired = !resetAt || Date.now() >= resetAt.getTime();

  const update = expired
    ? { ai_refreshes_used_this_month: 1, ai_refreshes_reset_at: firstDayOfNextMonth() }
    : { ai_refreshes_used_this_month: (user?.ai_refreshes_used_this_month ?? 0) + 1 };

  await supabaseAdmin.from('users').update(update).eq('id', userId);
}

/** Aggregate in-process hit/miss/tokens-saved across all users (for admin stats). */
function getGlobalRuntime() {
  let hits = 0;
  let misses = 0;
  let tokensSaved = 0;
  for (const s of runtimeStats.values()) {
    hits += s.hits;
    misses += s.misses;
    tokensSaved += s.tokensSaved;
  }
  return { hits, misses, tokensSaved };
}

module.exports = {
  getCached,
  saveCache,
  invalidateCache,
  getCacheStats,
  getGlobalRuntime,
  checkRefreshAllowed,
  incrementRefreshUsed,
  TTL_DEFAULTS,
  isoWeek,
  monthKey,
};
