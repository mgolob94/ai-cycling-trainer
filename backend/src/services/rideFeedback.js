const axios = require('axios');
const { supabaseAdmin } = require('../db/supabase');
const { getCached, saveCache } = require('./aiCache');
const ftpService = require('./ftp');

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o';

// 'ride_feedback' is permanent — the ride and its survey never change.
const FEEDBACK_TTL_HOURS = 8760;

// Effort scale: 1 too easy · 2 about right · 3 hard · 4 too much.
const EFFORT_LABEL = { 1: 'too easy', 2: 'about right', 3: 'hard', 4: 'too much' };
// Feeling scale: 1 fresh · 2 normal · 3 tired.
const FEELING_LABEL = { 1: 'fresh', 2: 'normal', 3: 'tired' };

/** Minimal OpenAI chat call (kept local to avoid a cycle with aiCoach). */
async function callOpenAI(messages, { maxTokens = 120, temperature = 0.5 } = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const { data } = await axios.post(
    `${OPENAI_API_BASE}/chat/completions`,
    { model: MODEL, messages, temperature, max_tokens: maxTokens },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
  );
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned an empty response');
  return { content: content.trim(), tokens: data.usage?.total_tokens ?? null };
}

const cacheKeyFor = (stravaActivityId) => `feedback_${stravaActivityId}`;

/** The planned workout (if any) for a given date, from the canonical weekly plan. */
async function findPlannedWorkout(userId, workoutDate) {
  if (!workoutDate) return null;
  const dow = new Date(`${workoutDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const { data } = await supabaseAdmin
    .from('training_plans')
    .select('plan_json, week_start')
    .eq('user_id', userId)
    .lte('week_start', workoutDate)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  const workouts = Array.isArray(data?.plan_json?.workouts) ? data.plan_json.workouts : [];
  return workouts.find((w) => w.day === dow) ?? null;
}

/**
 * Generate (and cache) brief post-ride coach feedback for one ride. Returns
 * { feedback_text, cached }. Cached permanently in ai_analysis_cache under
 * 'ride_feedback' — ride data never changes.
 */
async function generateRideFeedback(userId, stravaActivityId, survey = {}) {
  const cacheKey = cacheKeyFor(stravaActivityId);
  const cached = await getCached(userId, 'ride_feedback', cacheKey);
  if (cached.hit) {
    return { feedback_text: cached.data?.feedback_text ?? '', cached: true };
  }

  // Gather context: ride, planned workout, FTP, recent metrics, phase, pattern.
  const [{ data: ride }, planned, latestFtp, { data: metrics }, { data: profile }, { data: recent }] = await Promise.all([
    supabaseAdmin.from('rides').select('*').eq('user_id', userId).eq('strava_id', stravaActivityId).maybeSingle(),
    findPlannedWorkout(userId, survey.workout_date),
    ftpService.getLatest(userId),
    supabaseAdmin
      .from('performance_metrics')
      .select('tsb, ctl')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from('users').select('current_phase').eq('id', userId).maybeSingle(),
    supabaseAdmin
      .from('workout_feedback')
      .select('workout_date, perceived_effort, post_feeling, completion_status')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false })
      .limit(5),
  ]);

  const ftp = latestFtp?.ftp_watts ?? null;
  const np = ride?.normalized_power ?? ride?.avg_power_w ?? null;
  const durMin = ride?.duration_sec ? Math.round(ride.duration_sec / 60) : null;
  const pctFtp = ftp && np ? Math.round((np / ftp) * 100) : null;
  const phase = profile?.current_phase ?? null;

  const patternSummary = (recent || [])
    .map((f) => `${f.completion_status ?? '?'}/effort ${f.perceived_effort ?? '?'}`)
    .join(', ') || 'no prior feedback';

  const system =
    'You are a cycling coach giving brief post-ride feedback. ' +
    'Max 2 sentences. Be specific to the numbers. ' +
    'Start with what went well. End with one actionable observation. ' +
    "Never start with 'Great job' or 'Well done' — be direct. Respond in English.";

  const user = [
    `Ride: ${durMin ?? '?'}min, NP ${np ?? '?'}W${pctFtp != null ? ` (${pctFtp}% FTP)` : ''}, TSS ${ride?.tss ?? '?'}`,
    `Planned: ${planned?.type ?? 'unstructured'}${planned?.duration_min ? `, ${planned.duration_min}min` : ''}`,
    `Athlete felt: effort ${survey.perceived_effort ?? '?'}/4 (${EFFORT_LABEL[survey.perceived_effort] ?? '—'}), feeling after ${survey.post_feeling ?? '?'}/3 (${FEELING_LABEL[survey.post_feeling] ?? '—'})`,
    `Current phase: ${phase ?? 'unknown'}, TSB: ${metrics?.tsb != null ? Math.round(metrics.tsb) : '?'}`,
    `Last 5 rides pattern: ${patternSummary}`,
  ].join('\n');

  const { content, tokens } = await callOpenAI([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);

  await saveCache(userId, 'ride_feedback', cacheKey, { feedback_text: content }, tokens, MODEL, FEEDBACK_TTL_HOURS);
  return { feedback_text: content, cached: false };
}

/**
 * Record a post-workout survey response (upsert, one per ride) and generate the
 * coach feedback. Returns { feedback_text, cached }. Feedback generation is
 * best-effort — a failed AI call still keeps the saved survey.
 */
async function recordFeedback(userId, stravaActivityId, survey = {}) {
  const planned = await findPlannedWorkout(userId, survey.workout_date);
  const row = {
    user_id: userId,
    strava_activity_id: stravaActivityId ?? null,
    workout_date: survey.workout_date || new Date().toISOString().slice(0, 10),
    planned_workout_type: planned?.type ?? null,
    completion_status: survey.completion_status ?? null,
    perceived_effort: survey.perceived_effort ?? null,
    post_feeling: survey.post_feeling ?? null,
    planned_tss: survey.planned_tss ?? planned?.tss ?? null,
    actual_tss: survey.actual_tss ?? null,
  };

  const onConflict = stravaActivityId ? 'user_id,strava_activity_id' : undefined;
  const { error } = await supabaseAdmin
    .from('workout_feedback')
    .upsert(row, onConflict ? { onConflict } : undefined);
  if (error) throw error;

  // Skipped rides get no AI feedback (there's nothing to analyze).
  if (!stravaActivityId || survey.completion_status === 'skipped') {
    return { feedback_text: null, cached: false };
  }

  try {
    const result = await generateRideFeedback(userId, stravaActivityId, survey);
    await supabaseAdmin
      .from('workout_feedback')
      .update({ coach_feedback: result.feedback_text, coach_feedback_generated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('strava_activity_id', stravaActivityId);
    return result;
  } catch (err) {
    console.warn('[rideFeedback] feedback generation failed:', err.message);
    return { feedback_text: null, cached: false };
  }
}

/** The stored feedback row for one ride, or null. */
async function getFeedback(userId, stravaActivityId) {
  const { data } = await supabaseAdmin
    .from('workout_feedback')
    .select('completion_status, perceived_effort, post_feeling, coach_feedback, coach_feedback_generated_at')
    .eq('user_id', userId)
    .eq('strava_activity_id', stravaActivityId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Summarize the last n feedback entries into patterns the weekly plan generator
 * acts on. Returns counts, completion rate, average effort, a tired-pattern
 * flag, and a deterministic plan adjustment recommendation.
 */
async function getFeedbackSummary(userId, n = 10) {
  const { data } = await supabaseAdmin
    .from('workout_feedback')
    .select('workout_date, planned_workout_type, perceived_effort, post_feeling, completion_status')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false })
    .limit(n);

  const rows = data || [];
  const count = rows.length;
  if (!count) {
    return { count: 0, entries: [], completion_rate: null, avg_effort: null, hard_count: 0, easy_count: 0, tired_pattern: false, adjustment: null };
  }

  const completed = rows.filter((f) => f.completion_status === 'completed').length;
  const completionRate = Math.round((completed / count) * 100);
  const efforts = rows.map((f) => f.perceived_effort).filter((e) => e != null);
  const avgEffort = efforts.length ? Math.round((efforts.reduce((s, e) => s + e, 0) / efforts.length) * 10) / 10 : null;
  const hardCount = rows.filter((f) => f.perceived_effort === 4).length; // 'too much'
  const easyCount = rows.filter((f) => f.perceived_effort === 1).length; // 'too easy'
  const feelings = rows.map((f) => f.post_feeling).filter((x) => x != null);
  const tiredPattern = feelings.length >= 3 && feelings.every((x) => x === 3);

  // Deterministic coaching rule → the adjustment the plan generator applies.
  let adjustment = null;
  if (completionRate < 70) {
    adjustment = { kind: 'volume', reason: `completion ${completionRate}%`, message: "Plan updated. Fewer workouts this week — better to nail 3 than rush through 5." };
  } else if (hardCount >= 3) {
    adjustment = { kind: 'reduced', reason: `${hardCount} rides felt too hard`, message: "Plan updated. Last week was tough — this week's intensity is dialled back slightly." };
  } else if (easyCount >= 3) {
    adjustment = { kind: 'increased', reason: `${easyCount} rides felt too easy`, message: "Plan updated. You've been handling the load well — stepping it up a notch this week." };
  }

  return {
    count,
    entries: rows,
    completion_rate: completionRate,
    avg_effort: avgEffort,
    hard_count: hardCount,
    easy_count: easyCount,
    tired_pattern: tiredPattern,
    adjustment,
  };
}

module.exports = { generateRideFeedback, recordFeedback, getFeedback, getFeedbackSummary };
