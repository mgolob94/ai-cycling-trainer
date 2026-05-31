const { supabaseAdmin } = require('../db/supabase');
const { invalidateCache } = require('./aiCache');

// Unified daily recovery score (0–100), independent of the data source.
// Combines HRV (40%), sleep (35%), and training load (25%). Copy is English to
// match the app.

const HRV_BASELINE_DAYS = 30;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);

/** Linear map of x in [x0,x1] → [y0,y1], clamped to that output range. */
function scale(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  const y = y0 + t * (y1 - y0);
  return clamp(y, Math.min(y0, y1), Math.max(y0, y1));
}

const dayBounds = (date) => ({ start: `${date}T00:00:00Z`, end: `${date}T23:59:59.999Z` });
function isoDaysBefore(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// a) HRV component (40%)
// ---------------------------------------------------------------------------
function hrvScoreFromPct(pct) {
  if (pct > 0.2) return scale(pct, 0.2, 0.4, 90, 100);
  if (pct > 0.1) return scale(pct, 0.1, 0.2, 75, 90);
  if (pct >= -0.1) return scale(pct, -0.1, 0.1, 50, 75);
  if (pct >= -0.2) return scale(pct, -0.2, -0.1, 25, 50);
  return scale(pct, -0.4, -0.2, 0, 25);
}

async function computeHrvScore(userId, date) {
  const { start, end } = dayBounds(date);

  // Whoop, if connected, supplies its own recovery score — use it directly.
  const { data: whoopConn } = await supabaseAdmin
    .from('source_connections')
    .select('is_connected')
    .eq('user_id', userId)
    .eq('source', 'whoop')
    .maybeSingle();

  if (whoopConn?.is_connected) {
    const { data: whoopReading } = await supabaseAdmin
      .from('hrv_readings')
      .select('raw_data')
      .eq('user_id', userId)
      .eq('source', 'whoop')
      .gte('recorded_at', start)
      .lte('recorded_at', end)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const raw = whoopReading?.raw_data || {};
    const whoopScore = raw.recovery_score ?? raw.recovery ?? raw.score;
    if (typeof whoopScore === 'number') return clamp(round(whoopScore), 0, 100);
  }

  // Today's HRV (average across the day if multiple samples).
  const { data: todayRows } = await supabaseAdmin
    .from('hrv_readings')
    .select('hrv_ms')
    .eq('user_id', userId)
    .gte('recorded_at', start)
    .lte('recorded_at', end)
    .not('hrv_ms', 'is', null);
  const todayVals = (todayRows || []).map((r) => r.hrv_ms).filter((v) => v != null);
  if (!todayVals.length) return null; // no HRV → caller uses subjective proxy
  const today = todayVals.reduce((s, v) => s + v, 0) / todayVals.length;

  // 30-day rolling baseline (prior readings, excluding today).
  const { data: baseRows } = await supabaseAdmin
    .from('hrv_readings')
    .select('hrv_ms')
    .eq('user_id', userId)
    .gte('recorded_at', isoDaysBefore(date, HRV_BASELINE_DAYS))
    .lt('recorded_at', start)
    .not('hrv_ms', 'is', null);
  const baseVals = (baseRows || []).map((r) => r.hrv_ms).filter((v) => v != null);
  if (!baseVals.length) return null; // no baseline yet → caller uses proxy
  const baseline = baseVals.reduce((s, v) => s + v, 0) / baseVals.length;
  if (baseline <= 0) return null;

  return round(hrvScoreFromPct((today - baseline) / baseline));
}

// ---------------------------------------------------------------------------
// b) Sleep component (35%)
// ---------------------------------------------------------------------------
function durationScore(min) {
  if (min < 300) return 0; // < 5h
  if (min < 360) return 40; // 5–6h
  if (min < 420) return 65; // 6–7h
  if (min < 480) return 85; // 7–8h
  if (min <= 540) return 100; // 8–9h
  return 90; // > 9h
}

async function computeSleepScore(userId, date) {
  const { data: sleep } = await supabaseAdmin
    .from('sleep_sessions')
    .select('duration_min, deep_min, rem_min, sleep_score')
    .eq('user_id', userId)
    .eq('date', date)
    .order('duration_min', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sleep || !sleep.duration_min) return 60; // no sleep data → assume average

  const dScore = durationScore(sleep.duration_min);
  // Quality = restorative sleep fraction (deep + REM); neutral if stages absent.
  const deepRem = (sleep.deep_min ?? 0) + (sleep.rem_min ?? 0);
  const hasStages = sleep.deep_min != null || sleep.rem_min != null;
  const qScore = hasStages && sleep.duration_min > 0 ? clamp((deepRem / sleep.duration_min) * 100, 0, 100) : 65;

  return round(dScore * 0.6 + qScore * 0.4);
}

// ---------------------------------------------------------------------------
// c) Training-load component (25%)
// ---------------------------------------------------------------------------
async function computeLoadScore(userId, date) {
  // Most recent performance_metrics row up to the date; prefer the current
  // snapshot (current_atl/current_tsb), falling back to the weekly samples.
  const { data: pm } = await supabaseAdmin
    .from('performance_metrics')
    .select('atl, tsb, current_atl, current_tsb')
    .eq('user_id', userId)
    .lte('week_start', date)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pm) return 75; // no load data → assume moderate

  const atl = pm.current_atl ?? pm.atl ?? 0;
  const tsb = pm.current_tsb ?? pm.tsb ?? 0;

  let score;
  if (atl < 40) score = 90;
  else if (atl < 60) score = 75;
  else if (atl < 80) score = 55;
  else score = 30;

  if (tsb < -20) score -= 15; // deep fatigue → harder to recover

  return clamp(round(score), 0, 100);
}

// ---------------------------------------------------------------------------
// Readiness label + recommendation
// ---------------------------------------------------------------------------
function readinessFor(score) {
  if (score >= 85) return { label: 'optimal', recommendation: 'You can handle anything today — intervals, a long ride, or a race.' };
  if (score >= 70) return { label: 'good', recommendation: 'Good recovery. Train as planned.' };
  if (score >= 50) return { label: 'moderate', recommendation: 'Ease intensity by 15–20%. Prioritize Zone 2.' };
  if (score >= 30) return { label: 'poor', recommendation: 'Easy ride or a rest day. Focus on sleep tonight.' };
  return { label: 'rest', recommendation: 'Your body needs rest. No training today.' };
}

/**
 * Calculate, persist, and return the unified recovery score for a user/day.
 * `date` is 'YYYY-MM-DD' (defaults to today, UTC).
 */
// Subjective morning check-in (1–5) → HRV-score proxy when no HRV data exists.
const SUBJECTIVE_PROXY = { 1: 15, 2: 35, 3: 55, 4: 75, 5: 90 };

async function calculateRecoveryScore(userId, date = new Date().toISOString().slice(0, 10)) {
  const [hrvRaw, sleepScore, loadScore] = await Promise.all([
    computeHrvScore(userId, date),
    computeSleepScore(userId, date),
    computeLoadScore(userId, date),
  ]);

  // Existing row may carry today's morning check-in (subjective_feeling).
  const { data: existing } = await supabaseAdmin
    .from('recovery_scores')
    .select('subjective_feeling, check_in_source')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  const subjective = existing?.subjective_feeling ?? null;

  // HRV component: real HRV if available, else the subjective proxy, else
  // neutral 50 (no check-in and no HRV → plan doesn't change).
  let hrvScore;
  let checkInSource = existing?.check_in_source ?? null;
  if (hrvRaw != null) {
    hrvScore = hrvRaw;
    checkInSource = checkInSource ?? 'apple_health';
  } else if (subjective != null) {
    hrvScore = SUBJECTIVE_PROXY[subjective] ?? 55;
    checkInSource = 'manual';
  } else {
    hrvScore = 50;
  }

  const recoveryScore = round(hrvScore * 0.4 + sleepScore * 0.35 + loadScore * 0.25);
  const { label, recommendation } = readinessFor(recoveryScore);

  const row = {
    user_id: userId,
    date,
    recovery_score: recoveryScore,
    hrv_score: hrvScore,
    sleep_score: sleepScore,
    training_load_score: loadScore,
    subjective_feeling: subjective,
    check_in_source: checkInSource,
    readiness_label: label,
    recommendation,
  };

  const { error } = await supabaseAdmin
    .from('recovery_scores')
    .upsert(row, { onConflict: 'user_id,date' });
  if (error) throw error;

  // Recovery changes today's guidance — refresh the recommendations cache.
  try {
    await invalidateCache(userId, 'recommendations', null, 'recovery_score');
  } catch (e) {
    console.warn('[recovery] cache invalidation skipped:', e.message);
  }

  // Silently adapt today's planned workout to the new score (no UI/explanation).
  try {
    const adaptive = require('./adaptiveTraining');
    await adaptive.adaptTodayForUser(userId, date);
  } catch (e) {
    console.warn('[recovery] silent plan adaptation skipped:', e.message);
  }

  return row;
}

/**
 * Recalculate today's recovery score for every user who has any recovery data
 * source connected or recent HRV/sleep input. Used by the daily cron.
 */
async function calculateForAllUsers(date = new Date().toISOString().slice(0, 10)) {
  const userIds = new Set();
  for (const table of ['source_connections', 'hrv_readings', 'sleep_sessions']) {
    const { data } = await supabaseAdmin.from(table).select('user_id');
    for (const r of data || []) userIds.add(r.user_id);
  }

  const results = { processed: 0, failed: 0 };
  for (const userId of userIds) {
    try {
      await calculateRecoveryScore(userId, date);
      results.processed += 1;
    } catch (e) {
      results.failed += 1;
      console.warn('[recovery] failed for', userId, e.message);
    }
  }
  return results;
}

module.exports = {
  calculateRecoveryScore,
  calculateForAllUsers,
  // exported for testing
  hrvScoreFromPct,
  durationScore,
  readinessFor,
};
