const { supabaseAdmin } = require('../db/supabase');
const { getCacheStats, invalidateCache, getGlobalRuntime } = require('../services/aiCache');

/** GET /cache/stats — the authenticated user's cache stats + per-type breakdown. */
async function userStats(req, res, next) {
  try {
    const base = await getCacheStats(req.user.id);

    const { data } = await supabaseAdmin
      .from('ai_analysis_cache')
      .select('analysis_type, tokens_used')
      .eq('user_id', req.user.id)
      .eq('is_valid', true);

    const byType = {};
    for (const row of data || []) {
      const t = byType[row.analysis_type] || { analysis_type: row.analysis_type, entries: 0, tokens: 0 };
      t.entries += 1;
      t.tokens += row.tokens_used || 0;
      byType[row.analysis_type] = t;
    }

    res.json({
      success: true,
      data: {
        total_cached: base.total_analyses_cached,
        tokens_saved: base.total_tokens_saved,
        hit_rate: base.cache_hit_rate_percent,
        breakdown_by_type: Object.values(byType),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /cache/entries — all of the user's cache entries, newest first. */
async function entries(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_analysis_cache')
      .select('analysis_type, cache_key, generated_at, expires_at, tokens_used, is_valid')
      .eq('user_id', req.user.id)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [], error: null });
  } catch (err) {
    next(err);
  }
}

/** DELETE /cache/invalidate — user forces regeneration of an analysis. */
async function invalidate(req, res, next) {
  try {
    const { analysis_type: analysisType, cache_key: cacheKey, all } = req.body || {};

    // { all: true } clears every analysis type for the user (Profile "refresh all").
    if (all === true) {
      await invalidateCache(req.user.id, null, null, 'manual_user_all');
      return res.json({
        success: true,
        data: { invalidated: true, message: 'All analyses will be regenerated on the next request.' },
        error: null,
      });
    }

    if (!analysisType) {
      return res.status(400).json({ success: false, data: null, error: 'analysis_type is required' });
    }
    await invalidateCache(req.user.id, analysisType, cacheKey ?? null, 'manual_user');
    res.json({
      success: true,
      data: {
        invalidated: true,
        message: 'Analysis will be regenerated on the next request.',
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /admin/cache/stats — platform-wide cache stats (admin only). */
async function adminStats(req, res, next) {
  try {
    const { data: me } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();
    if (!me || me.role !== 'admin') {
      return res.status(403).json({ success: false, data: null, error: 'Admin access required' });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_analysis_cache')
      .select('user_id, analysis_type, tokens_used, is_valid');
    if (error) throw error;

    const valid = (data || []).filter((r) => r.is_valid);
    const totalTokens = valid.reduce((s, r) => s + (r.tokens_used || 0), 0);

    const byUser = {};
    const byType = {};
    for (const r of valid) {
      const u = byUser[r.user_id] || { user_id: r.user_id, tokens_saved: 0, entries: 0 };
      u.tokens_saved += r.tokens_used || 0;
      u.entries += 1;
      byUser[r.user_id] = u;

      const t = byType[r.analysis_type] || { analysis_type: r.analysis_type, entries: 0, tokens: 0 };
      t.entries += 1;
      t.tokens += r.tokens_used || 0;
      byType[r.analysis_type] = t;
    }

    const top10 = Object.values(byUser).sort((a, b) => b.tokens_saved - a.tokens_saved).slice(0, 10);
    const global = getGlobalRuntime();
    const totalRequests = global.hits + global.misses;

    res.json({
      success: true,
      data: {
        total_entries: valid.length,
        total_tokens_saved: totalTokens,
        cache_hit_rate_percent: totalRequests ? Math.round((global.hits / totalRequests) * 1000) / 10 : 0,
        top_users: top10,
        breakdown_by_type: Object.values(byType),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { userStats, entries, invalidate, adminStats };
