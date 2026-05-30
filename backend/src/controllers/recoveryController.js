const recoveryScore = require('../services/recoveryScore');

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

module.exports = { calculate, calculateAll };
