const { supabaseAdmin } = require('../db/supabase');
const { getCached, saveCache, isoWeek, TTL_DEFAULTS } = require('./aiCache');
const aiCoach = require('./aiCoach');

// Mid-week + end-of-week coach check-ins. Cached per ISO week. English copy.

const MODEL = 'gpt-4o';

function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((d.getUTCDay() === 0 ? -6 : 1) - d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

/** Gather this week's plan + completion so far. */
async function weekProgress(userId) {
  const weekStart = mondayOf();
  const { data: plan } = await supabaseAdmin
    .from('training_plans')
    .select('plan_json')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  const workouts = plan?.plan_json?.workouts ?? [];
  const planned = workouts.filter((w) => (w.type ?? '') !== 'rest').length;
  const tssTarget = plan?.plan_json?.tss_target ?? plan?.plan_json?.tss_planned ?? null;

  const { data: feedback } = await supabaseAdmin
    .from('workout_feedback')
    .select('completion_status, actual_tss')
    .eq('user_id', userId)
    .gte('workout_date', weekStart);
  const completed = (feedback || []).filter((f) => f.completion_status === 'completed').length;
  const tssAchieved = (feedback || []).reduce((s, f) => s + (f.actual_tss || 0), 0);

  return { weekStart, planned, completed, remaining: Math.max(0, planned - completed), tssTarget, tssAchieved };
}

async function callJson(userId, task, maxTokens = 400) {
  const athlete = await aiCoach.gatherAthleteContext(userId);
  const system = aiCoach.buildCoachSystemPrompt(athlete);
  const { content, tokens } = await aiCoach.callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: task },
    ],
    { json: true, maxTokens }
  );
  return { parsed: JSON.parse(content), tokens };
}

/** Wednesday mid-week check (≈18:00). */
async function midWeekCheckIn(userId) {
  const cacheKey = `midweek_${isoWeek()}`;
  const cached = await getCached(userId, 'midweek_checkin', cacheKey);
  if (cached.hit) return { ...cached.data, _cached: true };

  const p = await weekProgress(userId);
  const task = [
    `Mid-week check-in. So far this week the athlete completed ${p.completed} of ${p.planned} planned workouts (${p.remaining} remaining).`,
    'Decide whether the rest of the week needs adjusting based on recovery and completion.',
    'Return JSON: { check_in_type: "midweek", progress_label: string, remaining_workouts: number, adjustment_needed: boolean, adjustment_message: string|null, motivation_message: string }',
  ].join('\n');
  const { parsed, tokens } = await callJson(userId, task);
  const result = { check_in_type: 'midweek', remaining_workouts: p.remaining, ...parsed };
  await saveCache(userId, 'midweek_checkin', cacheKey, result, tokens, MODEL, TTL_DEFAULTS.midweek_checkin);
  return { ...result, _cached: false };
}

/** Sunday end-of-week review (≈20:00). */
async function endOfWeekReview(userId) {
  const cacheKey = `endofweek_${isoWeek()}`;
  const cached = await getCached(userId, 'endofweek_checkin', cacheKey);
  if (cached.hit) return { ...cached.data, _cached: true };

  const p = await weekProgress(userId);
  const completionPct = p.planned ? Math.round((p.completed / p.planned) * 100) : 0;
  const task = [
    `End-of-week review. Completed ${p.completed}/${p.planned} workouts (${completionPct}%).`,
    `TSS achieved ${Math.round(p.tssAchieved)} vs planned ${p.tssTarget ?? 'n/a'}.`,
    'Score the week 1-10, give specific personal feedback, and tease next week.',
    'Return JSON: { check_in_type: "endofweek", week_score: number, week_label: string, tss_achieved: number, tss_planned: number, completion_pct: number, coach_feedback: string, next_week_preview: string, celebration: string|null }',
  ].join('\n');
  const { parsed, tokens } = await callJson(userId, task, 500);
  const result = {
    check_in_type: 'endofweek',
    tss_achieved: Math.round(p.tssAchieved),
    tss_planned: p.tssTarget ?? 0,
    completion_pct: completionPct,
    ...parsed,
  };
  await saveCache(userId, 'endofweek_checkin', cacheKey, result, tokens, MODEL, TTL_DEFAULTS.endofweek_checkin);
  return { ...result, _cached: false };
}

module.exports = { midWeekCheckIn, endOfWeekReview };
