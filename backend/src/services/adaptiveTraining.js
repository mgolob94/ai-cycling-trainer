const { supabaseAdmin } = require('../db/supabase');
const recoveryScore = require('./recoveryScore');

// Adjusts today's planned workout based on the user's recovery score. Notes are
// English to match the app. The adapted workout keeps the original shape
// ({ day, type, duration_min, intensity, description, ... }) plus an
// `adaptation` block describing what changed and why.

const INTENSITY_DOWN = { hard: 'moderate', moderate: 'easy', easy: 'easy' };

/** Lower a zone label by one (Z5→Z4 …), floored at Z2. */
function downgradeZone(z) {
  const m = /^Z([1-7])$/.exec(String(z));
  if (!m) return z;
  return `Z${Math.max(2, Number(m[1]) - 1)}`;
}

/** Apply zone downgrades to any optional zone fields a workout may carry. */
function downgradeZones(workout) {
  const out = { ...workout };
  if (typeof out.target_zone === 'string') out.target_zone = downgradeZone(out.target_zone);
  if (typeof out.zone === 'string') out.zone = downgradeZone(out.zone);
  if (Array.isArray(out.zones)) out.zones = out.zones.map(downgradeZone);
  return out;
}

function isHighIntensity(workout) {
  if (!workout) return false;
  if (workout.intensity === 'hard') return true;
  if (['intervals', 'tempo'].includes(String(workout.type).toLowerCase())) return true;
  const z = workout.target_zone || workout.zone;
  if (typeof z === 'string' && /^Z[4-7]$/.test(z)) return true;
  if (Array.isArray(workout.zones) && workout.zones.some((x) => /^Z[4-7]$/.test(String(x)))) return true;
  return false;
}

/**
 * Warn when an intense session is planned on poor/rest recovery.
 * Returns { level, message } or null.
 */
function shouldWarnUser(recoveryScoreValue, plannedWorkout) {
  if (recoveryScoreValue < 50 && isHighIntensity(plannedWorkout)) {
    return {
      level: 'warning',
      message: 'Intense training on poor recovery raises your injury risk.',
    };
  }
  return null;
}

/** Build the `adaptation` metadata block. */
function meta(original, score, label, adapted, note) {
  return {
    adapted,
    recovery_score: score,
    readiness_label: label,
    note,
    original: { type: original.type, intensity: original.intensity, duration_min: original.duration_min },
  };
}

/**
 * Adapt a single workout for the user's recovery on `date`. Fetches the day's
 * recovery score (computing it if missing). Returns the (possibly modified)
 * workout with an `adaptation` block.
 */
async function adaptWorkoutForRecovery(userId, date, originalWorkout) {
  let { data: rec } = await supabaseAdmin
    .from('recovery_scores')
    .select('recovery_score, readiness_label')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (!rec) {
    // No score yet → compute one so adaptation is always grounded.
    rec = await recoveryScore.calculateRecoveryScore(userId, date);
  }

  const score = rec.recovery_score;
  const label = rec.readiness_label;
  const w = { ...originalWorkout };

  // optimal (85–100): unchanged, optional encouragement.
  if (score >= 85) {
    return { ...w, adaptation: meta(originalWorkout, score, label, false, 'Excellent recovery — you can add 10 min if you feel good.') };
  }

  // good (70–84): unchanged, train as planned.
  if (score >= 70) {
    return { ...w, adaptation: meta(originalWorkout, score, label, false, 'Good recovery — train as planned.') };
  }

  // moderate (50–69): drop one zone/intensity, −15% duration.
  if (score >= 50) {
    const adapted = downgradeZones(w);
    adapted.intensity = INTENSITY_DOWN[w.intensity] ?? w.intensity;
    adapted.duration_min = w.duration_min ? Math.round(w.duration_min * 0.85) : w.duration_min;
    adapted.name = `Adapted · ${w.name ?? w.type ?? 'Workout'}`;
    return { ...adapted, adaptation: meta(originalWorkout, score, label, true, 'Reduced intensity due to recovery.') };
  }

  // poor (30–49): replace with an easy Z2 endurance ride, 60% duration.
  if (score >= 30) {
    return {
      ...w,
      name: 'Adapted · Easy aerobic ride',
      type: 'recovery_ride',
      intensity: 'easy',
      target_zone: 'Z2',
      duration_min: w.duration_min ? Math.round(w.duration_min * 0.6) : 45,
      description: 'Easy aerobic spin in Zone 2 to aid recovery.',
      adaptation: meta(originalWorkout, score, label, true, 'Swapped for an easy aerobic workout.'),
    };
  }

  // rest (0–29): full rest day.
  return {
    ...w,
    name: 'Rest day',
    type: 'rest',
    intensity: 'easy',
    duration_min: 0,
    description: 'Rest day — gentle stretching or an easy walk.',
    adaptation: meta(originalWorkout, score, label, true, 'Rest day recommended.'),
  };
}

// ---------------------------------------------------------------------------
// Plan lookup + persistence
// ---------------------------------------------------------------------------
function mondayOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekdayName(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

/**
 * Adapt today's planned workout for a user, persist it to
 * training_plans.adapted_workout, and return the result.
 */
async function adaptTodayForUser(userId, date = new Date().toISOString().slice(0, 10)) {
  const weekStart = mondayOf(date);

  // The plan covering this week (fall back to the most recent plan).
  let { data: plan } = await supabaseAdmin
    .from('training_plans')
    .select('id, plan_json')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (!plan) {
    const { data: latest } = await supabaseAdmin
      .from('training_plans')
      .select('id, plan_json')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    plan = latest ?? null;
  }
  if (!plan) return { date, plan_found: false, adapted: null, warning: null };

  const workouts = plan.plan_json?.workouts ?? [];
  const today = weekdayName(date);
  const original =
    workouts.find((w) => w.day === today) ?? { day: today, type: 'rest', duration_min: 0, intensity: 'easy', description: 'Rest day.' };

  const adapted = await adaptWorkoutForRecovery(userId, date, original);
  const warning = shouldWarnUser(adapted.adaptation.recovery_score, original);

  const payload = { date, original, adapted, warning };
  // Plain-English reason shown in the "Plan updated · Here's why" banner — only
  // when the workout was actually changed (otherwise clear any stale reason).
  const a = adapted.adaptation;
  const adaptationReason = a.adapted
    ? `Today's ${original.type} was adjusted — your recovery is ${a.recovery_score}/100 (${a.readiness_label ?? a.label ?? 'low'}). ${a.note}`
    : null;
  const { error } = await supabaseAdmin
    .from('training_plans')
    .update({ adapted_workout: payload, adaptation_reason: adaptationReason })
    .eq('id', plan.id);
  if (error) throw error;

  return { date, plan_found: true, recovery_score: adapted.adaptation.recovery_score, original, adapted, warning };
}

/** Adapt today's workout for every user with a training plan (daily cron). */
async function adaptForAllUsers(date = new Date().toISOString().slice(0, 10)) {
  const { data } = await supabaseAdmin.from('training_plans').select('user_id');
  const userIds = [...new Set((data || []).map((r) => r.user_id))];

  const results = { processed: 0, failed: 0 };
  for (const userId of userIds) {
    try {
      await adaptTodayForUser(userId, date);
      results.processed += 1;
    } catch (e) {
      results.failed += 1;
      console.warn('[adaptive] failed for', userId, e.message);
    }
  }
  return results;
}

module.exports = {
  adaptWorkoutForRecovery,
  shouldWarnUser,
  adaptTodayForUser,
  adaptForAllUsers,
  // exported for testing
  downgradeZone,
  isHighIntensity,
};
