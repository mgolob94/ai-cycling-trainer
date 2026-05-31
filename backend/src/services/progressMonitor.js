const { supabaseAdmin } = require('../db/supabase');
const { getCached, saveCache, TTL_DEFAULTS } = require('./aiCache');
const aiCoach = require('./aiCoach');
const pushNotifications = require('./pushNotifications');

// Monthly progress review (1st of month cron + manual). Cached per month.

const MODEL = 'gpt-4o';

function monthBounds(month) {
  // month = 'YYYY-MM'; returns [start, end) ISO dates and the previous month.
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevStart = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
  return { start, end: next, prevStart, prevEnd: start };
}

async function monthAggregates(userId, start, end) {
  const { data: weeks } = await supabaseAdmin
    .from('performance_metrics')
    .select('week_start, tss, ctl, total_distance_km, total_elevation_m, ride_count')
    .eq('user_id', userId)
    .gte('week_start', start)
    .lt('week_start', end)
    .order('week_start', { ascending: true });
  const w = weeks || [];
  return {
    tss: Math.round(w.reduce((s, x) => s + (x.tss || 0), 0)),
    distance: Math.round(w.reduce((s, x) => s + (x.total_distance_km || 0), 0)),
    elevation: Math.round(w.reduce((s, x) => s + (x.total_elevation_m || 0), 0)),
    rides: w.reduce((s, x) => s + (x.ride_count || 0), 0),
    ctlStart: w[0]?.ctl ?? null,
    ctlEnd: w[w.length - 1]?.ctl ?? null,
  };
}

const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

async function generateMonthlyReview(userId, month = new Date().toISOString().slice(0, 7)) {
  const cacheKey = `monthly_${month}`;
  const cached = await getCached(userId, 'monthly_review', cacheKey);
  if (cached.hit) return { ...cached.data, _cached: true };

  const { start, end, prevStart, prevEnd } = monthBounds(month);
  const [thisM, lastM] = await Promise.all([monthAggregates(userId, start, end), monthAggregates(userId, prevStart, prevEnd)]);

  const { data: ftps } = await supabaseAdmin
    .from('ftp_tests')
    .select('ftp_watts, test_date')
    .eq('user_id', userId)
    .gte('test_date', start)
    .lt('test_date', end)
    .order('test_date', { ascending: true });
  const ftpChange = ftps && ftps.length ? ftps[ftps.length - 1].ftp_watts - (ftps[0].ftp_watts ?? ftps[ftps.length - 1].ftp_watts) : 0;
  const ctlChange = thisM.ctlEnd != null && thisM.ctlStart != null ? Math.round(thisM.ctlEnd - thisM.ctlStart) : 0;

  const athlete = await aiCoach.gatherAthleteContext(userId);
  const system = aiCoach.buildCoachSystemPrompt(athlete);
  const task = [
    `Write the athlete's monthly review for ${monthLabel(month)}.`,
    `This month: ${thisM.tss} TSS, ${thisM.distance} km, ${thisM.elevation} m, ${thisM.rides} rides. Last month: ${lastM.tss} TSS, ${lastM.distance} km, ${lastM.rides} rides.`,
    `CTL change: ${ctlChange >= 0 ? '+' : ''}${ctlChange}. FTP change this month: ${ftpChange >= 0 ? '+' : ''}${ftpChange}W.`,
    'Be warm, specific, and honest. Return JSON: { month_label, headline, summary, achievements: string[], challenges: string[], next_month_focus, on_track_for_goal: boolean, goal_message, fitness_change: { ctl_change: number, label }, coach_message }',
  ].join('\n');

  const { content, tokens } = await aiCoach.callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: task },
    ],
    { json: true, maxTokens: 700 }
  );
  const parsed = JSON.parse(content);
  const result = { month_label: monthLabel(month), fitness_change: { ctl_change: ctlChange, label: `Fitness ${ctlChange >= 0 ? 'up' : 'down'} ${Math.abs(ctlChange)} points` }, ...parsed };

  await saveCache(userId, 'monthly_review', cacheKey, result, tokens, MODEL, TTL_DEFAULTS.monthly_review);
  pushNotifications.sendToUser(userId, { title: 'Your monthly review is ready 📊', body: result.headline ?? monthLabel(month), data: { screen: 'Progress' } }).catch(() => {});
  return { ...result, _cached: false };
}

/** Run the review for every user with metrics (1st-of-month cron). */
async function generateForAllUsers(month = new Date().toISOString().slice(0, 7)) {
  const { data } = await supabaseAdmin.from('performance_metrics').select('user_id');
  const userIds = [...new Set((data || []).map((r) => r.user_id))];
  const results = { processed: 0, failed: 0 };
  for (const userId of userIds) {
    try {
      await generateMonthlyReview(userId, month);
      results.processed += 1;
    } catch (e) {
      results.failed += 1;
      console.warn('[monthly] failed for', userId, e.message);
    }
  }
  return results;
}

module.exports = { generateMonthlyReview, generateForAllUsers };
