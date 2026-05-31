const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const progressMonitor = require('../services/progressMonitor');
const { supabaseAdmin } = require('../db/supabase');
const { getCached, saveCache } = require('../services/aiCache');

const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// Mounted at /progress (see index.js).
router.post('/monthly-review', requireAuth, async (req, res, next) => {
  try {
    const month = req.body?.month; // optional 'YYYY-MM'
    const review = await progressMonitor.generateMonthlyReview(req.user.id, month || undefined);
    res.json({ success: true, data: review, error: null });
  } catch (err) {
    next(err);
  }
});

// Batch (1st-of-month cron) — guarded by X-Cron-Secret.
router.post('/monthly-review-all', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) {
      return res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
    }
    const result = await progressMonitor.generateForAllUsers(req.body?.month || undefined);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

// POST /progress/monthly-reveal — the "4 weeks in, here's what changed" snapshot.
// Returns { eligible, data }. Eligible once the user is ≥28 days past onboarding
// and has ≥8 rides. The assembled snapshot is cached permanently per 4-week block.
router.post('/monthly-reveal', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('created_at, onboarding_completed')
      .eq('id', userId)
      .maybeSingle();

    const startMs = user?.created_at ? new Date(user.created_at).getTime() : Date.now();
    const daysSince = Math.floor((Date.now() - startMs) / 86400000);
    const monthNumber = Math.max(1, Math.floor(daysSince / 28));

    const { count: rideCount } = await supabaseAdmin
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const eligible = !!user?.onboarding_completed && daysSince >= 28 && (rideCount ?? 0) >= 8;
    if (!eligible) return res.json({ success: true, data: { eligible: false }, error: null });

    const cacheKey = `monthly_reveal_${userId}_${monthNumber}`;
    const cached = await getCached(userId, 'monthly_reveal', cacheKey);
    if (cached.hit) return res.json({ success: true, data: { eligible: true, ...cached.data }, error: null });

    // Fitness: CTL ~4 weeks ago vs now.
    const { data: weeks } = await supabaseAdmin
      .from('performance_metrics')
      .select('ctl, week_start')
      .eq('user_id', userId)
      .order('week_start', { ascending: true });
    const w = weeks || [];
    const now = w[w.length - 1] || {};
    const past = w.length >= 5 ? w[w.length - 5] : w[0] || {};
    const nowCtl = Math.round(now.ctl ?? 0);
    const week1Ctl = Math.round(past.ctl ?? 0);
    const ctlDelta = nowCtl - week1Ctl;

    // Consistency: rides in the last 28d vs the prior 28d.
    const since28 = daysAgoISO(28);
    const since56 = daysAgoISO(56);
    const { count: ridesThis } = await supabaseAdmin
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('ride_date', since28);
    const { count: ridesPrevRaw } = await supabaseAdmin
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('ride_date', since56)
      .lt('ride_date', since28);

    const { data: fb } = await supabaseAdmin
      .from('workout_feedback')
      .select('completion_status')
      .eq('user_id', userId)
      .gte('workout_date', since28);
    const fbRows = fb || [];
    const completed = fbRows.filter((f) => f.completion_status === 'completed').length;
    const plannedPct = fbRows.length ? Math.round((completed / fbRows.length) * 100) : null;

    // Best ride this month (highest TSS).
    const { data: best } = await supabaseAdmin
      .from('rides')
      .select('ride_date, distance_km, tss, normalized_power')
      .eq('user_id', userId)
      .gte('ride_date', since28)
      .order('tss', { ascending: false })
      .limit(1)
      .maybeSingle();

    const coachMessage =
      ctlDelta >= 5
        ? 'The work is showing — your fitness is climbing steadily. Next month, we build on it.'
        : ctlDelta > 0
          ? 'Steady progress this month. Consistency like this compounds — keep showing up.'
          : 'A settling month. The base you held onto sets up the gains coming next.';

    const payload = {
      month_number: monthNumber,
      fitness: {
        week1_ctl: week1Ctl,
        now_ctl: nowCtl,
        delta: ctlDelta,
        note: ctlDelta > 0 ? `That's ${ctlDelta} weeks of consistent training worth of fitness gain.` : 'You held your fitness through a tough stretch.',
      },
      consistency: { rides: ridesThis ?? 0, planned_pct: plannedPct, prev_rides: ridesPrevRaw ?? 0 },
      best_ride: best
        ? {
            title: best.ride_date ? `${best.ride_date} ride` : 'Your ride',
            date: best.ride_date,
            stat: best.tss != null ? `${Math.round(best.tss)} TSS` : best.distance_km != null ? `${Math.round(best.distance_km)} km` : '',
          }
        : null,
      coach_message: coachMessage,
    };

    await saveCache(userId, 'monthly_reveal', cacheKey, payload, null, null, 8760);
    res.json({ success: true, data: { eligible: true, ...payload }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
