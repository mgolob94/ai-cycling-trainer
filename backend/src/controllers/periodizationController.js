const { supabaseAdmin } = require('../db/supabase');
const metrics = require('../services/metrics');
const ftpService = require('../services/ftp');
const periodization = require('../services/periodization');

/** GET /periodization/plan — AI-suggested periodized week for the user's phase. */
async function plan(req, res, next) {
  try {
    const [{ data: profile }, { data: rides }, ftp] = await Promise.all([
      supabaseAdmin.from('users').select('*').eq('id', req.user.id).single(),
      supabaseAdmin.from('rides').select('*').eq('user_id', req.user.id).order('ride_date', { ascending: true }),
      ftpService.getLatest(req.user.id),
    ]);

    const recentMetrics = metrics.computeWeeklyMetrics(rides || [], {
      ftp: ftp?.ftp_watts,
      thresholdHr: metrics.estimateThresholdHr(profile?.age),
    });

    const result = await periodization.generatePlan({
      userProfile: profile || { id: req.user.id },
      ftpHistory: ftp ? [ftp] : [],
      recentMetrics,
    });

    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { plan };
