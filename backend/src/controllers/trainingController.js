const adaptiveTraining = require('../services/adaptiveTraining');

/**
 * POST /training/adapt-for-recovery — adapt the signed-in user's planned workout
 * for today based on their recovery score; persists to adapted_workout.
 */
async function adaptForRecovery(req, res, next) {
  try {
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    const result = await adaptiveTraining.adaptTodayForUser(req.user.id, date);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /training/adapt-for-recovery-all — batch for the daily 07:00 cron.
 * Guarded by X-Cron-Secret (not user auth).
 */
async function adaptForRecoveryAll(req, res, next) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) {
      return res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
    }
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    const result = await adaptiveTraining.adaptForAllUsers(date);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { adaptForRecovery, adaptForRecoveryAll };
