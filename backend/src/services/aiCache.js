const crypto = require('crypto');
const { supabaseAdmin } = require('../db/supabase');

const TABLE = 'ai_analysis_cache';

// Default time-to-live per analysis type, in hours.
const TTL_DEFAULTS = {
  weekly_summary: 168, // 1 week
  ride_analysis: 8760, // 1 year — ride data never changes
  trend_analysis: 720, // 1 month
  recommendations: 48, // 2 days
  periodization: 336, // 2 weeks
  rider_profile: 336, // 2 weeks
  ftp_insight: 8760, // 1 year — FTP test data never changes
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
  const ttl = ttlHours ?? TTL_DEFAULTS[analysisType] ?? FALLBACK_TTL;
  const now = Date.now();

  // Plan at generation time (users.subscription_plan may not exist → 'free').
  let plan = 'free';
  try {
    const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
    plan = user?.subscription_plan ?? 'free';
  } catch {
    // keep default
  }

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
 * Mark cache entries invalid. With a cacheKey, just that entry; otherwise every
 * entry of that analysis type for the user. Returns { invalidated: count }.
 */
async function invalidateCache(userId, analysisType, cacheKey = null) {
  let query = supabaseAdmin
    .from(TABLE)
    .update({ is_valid: false })
    .eq('user_id', userId)
    .eq('analysis_type', analysisType);
  if (cacheKey) query = query.eq('cache_key', cacheKey);

  const { data, error } = await query.select('id');
  if (error) throw error;
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

module.exports = { getCached, saveCache, invalidateCache, getCacheStats, TTL_DEFAULTS };
