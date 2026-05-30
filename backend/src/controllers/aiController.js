const ai = require('../services/ai');
const aiCoach = require('../services/aiCoach');
const metrics = require('../services/metrics');
const ftpService = require('../services/ftp');
const { supabaseAdmin } = require('../db/supabase');

/** Gather profile + rides + ftp + weekly metrics for a user. */
async function gatherContext(userId) {
  const [{ data: profile }, { data: rides }, ftp] = await Promise.all([
    supabaseAdmin.from('users').select('*').eq('id', userId).single(),
    supabaseAdmin.from('rides').select('*').eq('user_id', userId).order('ride_date', { ascending: true }),
    ftpService.getLatest(userId),
  ]);
  const weekly = metrics.computeWeeklyMetrics(rides || [], {
    ftp: ftp?.ftp_watts,
    thresholdHr: metrics.estimateThresholdHr(profile?.age),
  });
  return { profile: profile || { id: userId }, rides: rides || [], ftp, weekly };
}

/**
 * POST /ai/weekly-summary — generate a 2-sentence training summary from the
 * weekly metrics in the request body (uses the most recent 4 weeks).
 */
async function weeklySummary(req, res, next) {
  try {
    const weeks = Array.isArray(req.body?.weeks) ? req.body.weeks : null;
    if (!weeks || weeks.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Provide a non-empty "weeks" array of metrics.',
      });
    }

    const summary = await ai.generateWeeklySummary(weeks.slice(-4));
    res.json({ success: true, data: { summary }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /ai/week-analysis — structured analysis of the current week. Cached: if a
 * 'week' insight was generated in the last 3 days, return it instead of calling
 * the AI again.
 */
async function weekAnalysis(req, res, next) {
  try {
    const { profile, rides, ftp, weekly } = await gatherContext(req.user.id);
    const current = weekly[weekly.length - 1];
    if (!current) return res.json({ success: true, data: null, error: null });

    try {
      const { data: cached } = await supabaseAdmin
        .from('ai_insights')
        .select('content_json, created_at')
        .eq('user_id', req.user.id)
        .eq('insight_type', 'week')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached && Date.now() - new Date(cached.created_at).getTime() < 3 * 24 * 3600 * 1000) {
        return res.json({ success: true, data: cached.content_json, error: null });
      }
    } catch {
      // ai_insights table not migrated yet — just generate fresh.
    }

    const ridesThisWeek = rides.filter((r) => r.ride_date && r.ride_date >= current.week_start);
    const result = await aiCoach.analyzeWeek(profile, current, ridesThisWeek, ftp ? [ftp] : []);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /ai/trend — long-term (12-week) trend analysis. */
async function trend(req, res, next) {
  try {
    const { profile, weekly } = await gatherContext(req.user.id);
    const history = await ftpService.getHistory(req.user.id);
    const result = await aiCoach.analyzeTrend(profile, weekly.slice(-12), history);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { weeklySummary, weekAnalysis, trend };
