const { supabaseAdmin } = require('../db/supabase');
const notificationEngine = require('../services/notificationEngine');

/** POST /notifications/register — store this device's Expo push token. */
async function register(req, res, next) {
  try {
    const token = req.body?.token;
    if (!token) return res.status(400).json({ success: false, data: null, error: 'Missing token' });
    const { error } = await supabaseAdmin
      .from('push_tokens')
      .upsert({ user_id: req.user.id, token, platform: req.body?.platform ?? null }, { onConflict: 'token' });
    if (error) throw error;
    res.json({ success: true, data: { registered: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /notifications/run — evaluate + send due notifications for all users.
 * Guarded by X-Cron-Secret (invoked by the 15-min Edge Function), not user auth.
 */
async function run(req, res, next) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) {
      return res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
    }
    const result = await notificationEngine.runDue(new Date());
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, run };
