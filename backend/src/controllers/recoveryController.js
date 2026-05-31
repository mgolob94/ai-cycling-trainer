const recoveryScore = require('../services/recoveryScore');
const hrvAnalysis = require('../services/hrvAnalysis');
const { supabaseAdmin } = require('../db/supabase');
const { getCached, saveCache, isoWeek } = require('../services/aiCache');

/**
 * POST /recovery/check-in — save the morning subjective feeling (1–5), then
 * recompute the recovery score (which silently adapts today's plan). Returns
 * the score, but the UI does not surface it (recovery screen is hidden).
 */
async function checkIn(req, res, next) {
  try {
    const feeling = Number(req.body?.feeling);
    if (!Number.isInteger(feeling) || feeling < 1 || feeling > 5) {
      return res.status(400).json({ success: false, data: null, error: 'feeling must be 1–5' });
    }
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    await supabaseAdmin
      .from('recovery_scores')
      .upsert({ user_id: req.user.id, date, subjective_feeling: feeling, check_in_source: 'manual' }, { onConflict: 'user_id,date' });
    const result = await recoveryScore.calculateRecoveryScore(req.user.id, date);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /recovery/calculate — recompute the signed-in user's recovery score. */
async function calculate(req, res, next) {
  try {
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    const result = await recoveryScore.calculateRecoveryScore(req.user.id, date);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /recovery/calculate-all — batch recompute for all users. Not user-authed;
 * guarded by a shared secret so the daily Supabase cron (Edge Function) can call
 * it. No-op-safe to run repeatedly (upserts).
 */
async function calculateAll(req, res, next) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) {
      return res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
    }
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    const result = await recoveryScore.calculateForAllUsers(date);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /recovery/hrv/trend — HRV trend + HRV-vs-load correlation, cached 48h in
 * ai_analysis_cache (analysis_type 'hrv_trend').
 */
async function hrvTrend(req, res, next) {
  try {
    const userId = req.user.id;
    const cacheKey = `week_${isoWeek()}`;

    const cached = await getCached(userId, 'hrv_trend', cacheKey);
    if (cached.hit) {
      return res.json({ success: true, data: { ...cached.data, _cached: true, _generated_at: cached.generated_at }, error: null });
    }

    const [trend, correlation] = await Promise.all([
      hrvAnalysis.getHRVTrend(userId, 8),
      hrvAnalysis.getHRVvsTrainingLoad(userId, 8),
    ]);
    const result = { ...trend, training_load_correlation: correlation };

    await saveCache(userId, 'hrv_trend', cacheKey, result, 0, 'rule-based', 48);
    res.json({ success: true, data: { ...result, _cached: false }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { calculate, calculateAll, hrvTrend, checkIn };
