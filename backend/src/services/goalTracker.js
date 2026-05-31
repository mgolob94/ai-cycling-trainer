// Goal tracking — gives the AI coach a concrete target to coach toward.
// Progress is derived from the athlete's real data (FTP tests, rides,
// performance metrics, workout feedback); insights are AI-generated + cached.

const { supabaseAdmin } = require('../db/supabase');
const aiCoach = require('./aiCoach');
const { getCached, saveCache, TTL_DEFAULTS, monthKey } = require('./aiCache');

const MODEL = 'gpt-4o';
const MS_PER_WEEK = 7 * 24 * 3600 * 1000;
const MILESTONES = [25, 50, 75, 100];

const clampPct = (n) => Math.max(0, Math.min(100, Math.round(n)));
const weeksBetween = (from, to) => Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_WEEK);

async function fetchGoal(userId, goalId) {
  const { data } = await supabaseAdmin
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

/** FTP at (or most recently before) a given date; falls back to the earliest test. */
function ftpAt(ftpHistory, date) {
  if (!ftpHistory?.length) return null;
  const ts = new Date(date).getTime();
  const before = ftpHistory.filter((f) => new Date(f.test_date).getTime() <= ts);
  return (before.length ? before[before.length - 1] : ftpHistory[0])?.ftp_watts ?? null;
}

/** Fraction (0–1) of logged workouts marked completed. Defaults to 1 when no data. */
async function completionRate(userId, since) {
  let q = supabaseAdmin.from('workout_feedback').select('completion_status').eq('user_id', userId);
  if (since) q = q.gte('workout_date', new Date(since).toISOString().slice(0, 10));
  const { data } = await q;
  if (!data?.length) return 1;
  const done = data.filter((f) => f.completion_status === 'completed').length;
  return done / data.length;
}

/**
 * calculateGoalProgress(userId, goalId): number 0–100.
 * Computed from real data per goal type; does not persist.
 */
async function calculateGoalProgress(userId, goalId) {
  const goal = await fetchGoal(userId, goalId);
  if (!goal) return 0;

  switch (goal.goal_type) {
    case 'ftp_target': {
      const { data: ftps } = await supabaseAdmin
        .from('ftp_tests')
        .select('ftp_watts, test_date')
        .eq('user_id', userId)
        .order('test_date', { ascending: true });
      const start = ftpAt(ftps, goal.created_at);
      const current = ftps?.length ? ftps[ftps.length - 1].ftp_watts : start;
      if (!goal.target_ftp || start == null || current == null) return goal.current_progress ?? 0;
      if (goal.target_ftp <= start) return current >= goal.target_ftp ? 100 : 0;
      return clampPct(((current - start) / (goal.target_ftp - start)) * 100);
    }

    case 'distance': {
      const { data: rides } = await supabaseAdmin
        .from('rides')
        .select('distance_km')
        .eq('user_id', userId)
        .gte('ride_date', new Date(goal.created_at).toISOString().slice(0, 10));
      const total = (rides || []).reduce((s, r) => s + (r.distance_km || 0), 0);
      if (!goal.target_distance_km) return goal.current_progress ?? 0;
      return clampPct((total / goal.target_distance_km) * 100);
    }

    case 'consistency': {
      // Ride X days/week (X = profile training_days_per_week) every week since start.
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('training_days_per_week')
        .eq('id', userId)
        .maybeSingle();
      const targetDays = profile?.training_days_per_week ?? 4;
      const targetWeeks = Math.max(1, Math.round(weeksBetween(goal.created_at, goal.target_date || Date.now())));
      const { data: rides } = await supabaseAdmin
        .from('rides')
        .select('ride_date')
        .eq('user_id', userId)
        .gte('ride_date', new Date(goal.created_at).toISOString().slice(0, 10));
      const byWeek = {};
      for (const r of rides || []) {
        const wk = Math.floor((new Date(r.ride_date).getTime() - new Date(goal.created_at).getTime()) / MS_PER_WEEK);
        byWeek[wk] = (byWeek[wk] || 0) + 1;
      }
      const metWeeks = Object.values(byWeek).filter((d) => d >= targetDays).length;
      return clampPct((metWeeks / targetWeeks) * 100);
    }

    case 'fitness': {
      // Toward a CTL target stored in target_ftp (reused as the CTL number).
      const { data: metrics } = await supabaseAdmin
        .from('performance_metrics')
        .select('ctl, week_start')
        .eq('user_id', userId)
        .order('week_start', { ascending: true });
      if (!metrics?.length || !goal.target_ftp) return goal.current_progress ?? 0;
      const startRow = metrics.find((m) => new Date(m.week_start) >= new Date(goal.created_at)) || metrics[0];
      const start = startRow?.ctl ?? 0;
      const current = metrics[metrics.length - 1].ctl ?? start;
      if (goal.target_ftp <= start) return current >= goal.target_ftp ? 100 : 0;
      return clampPct(((current - start) / (goal.target_ftp - start)) * 100);
    }

    case 'event':
    default: {
      // Time-based readiness: weeks trained / weeks available × completion rate.
      const weeksAvailable = Math.max(1, weeksBetween(goal.created_at, goal.target_date || Date.now()));
      const weeksTrained = Math.min(weeksAvailable, weeksBetween(goal.created_at, Date.now()));
      const rate = await completionRate(userId, goal.created_at);
      return clampPct((weeksTrained / weeksAvailable) * rate * 100);
    }
  }
}

/**
 * generateGoalInsight(userId, goal): AI assessment of whether the athlete is on
 * track and what the critical path is. Cached goal_{id}_{YYYY-MM}, TTL 168h.
 * Returns { on_track, message, critical_action, estimated_achievement_date, progress }.
 */
async function generateGoalInsight(userId, goal) {
  const progress = await calculateGoalProgress(userId, goal.id);
  const cacheKey = `goal_${goal.id}_${monthKey(new Date())}`;
  const cached = await getCached(userId, 'goal_insight', cacheKey);
  if (cached.hit) return { ...cached.data, progress, _cached: true, _generated_at: cached.generated_at };

  const weeksRemaining = goal.target_date ? Math.max(0, Math.round(weeksBetween(Date.now(), goal.target_date))) : null;
  const athlete = await aiCoach.gatherAthleteContext(userId);
  const system = aiCoach.buildCoachSystemPrompt(athlete);
  const task = [
    `The athlete has a goal: "${goal.title || goal.goal_type}" (type: ${goal.goal_type}).`,
    goal.target_ftp ? `Target FTP: ${goal.target_ftp}W.` : '',
    goal.target_distance_km ? `Target distance: ${goal.target_distance_km}km.` : '',
    goal.target_event_name ? `Event: ${goal.target_event_name}.` : '',
    goal.target_date ? `Target date: ${goal.target_date}.` : '',
    `Current progress: ${progress}%. Weeks remaining: ${weeksRemaining ?? 'n/a'}.`,
    'Assess whether they are on track and identify the single most critical action.',
    'Return JSON exactly: {"on_track": boolean, "message": "1-2 sentence assessment", "critical_action": "the one thing to focus on", "estimated_achievement_date": "YYYY-MM-DD or null"}',
  ]
    .filter(Boolean)
    .join('\n');

  const { content, tokens } = await aiCoach.callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: task },
    ],
    { json: true, maxTokens: 300 }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { on_track: progress >= 50, message: content?.slice(0, 200) || '', critical_action: null, estimated_achievement_date: null };
  }
  await saveCache(userId, 'goal_insight', cacheKey, parsed, tokens, MODEL, TTL_DEFAULTS.goal_insight);
  return { ...parsed, progress, _cached: false };
}

/**
 * checkGoalMilestones(userId): recompute progress for every active goal, persist
 * it, and return any 25/50/75/100% milestones that were just crossed (for
 * celebrations). Goals reaching 100% are marked completed.
 */
async function checkGoalMilestones(userId) {
  const { data: goals } = await supabaseAdmin
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  const crossed = [];
  for (const goal of goals || []) {
    const progress = await calculateGoalProgress(userId, goal.id);
    const prev = goal.current_progress ?? 0;
    if (progress <= prev) {
      if (progress !== prev) await supabaseAdmin.from('goals').update({ current_progress: progress }).eq('id', goal.id);
      continue;
    }

    for (const m of MILESTONES) {
      if (prev < m && progress >= m) {
        crossed.push({ goal_id: goal.id, title: goal.title || goal.goal_type, milestone: m });
      }
    }

    const update = { current_progress: progress };
    if (progress >= 100) update.status = 'completed';
    await supabaseAdmin.from('goals').update(update).eq('id', goal.id);
  }
  return crossed;
}

module.exports = { calculateGoalProgress, generateGoalInsight, checkGoalMilestones };
