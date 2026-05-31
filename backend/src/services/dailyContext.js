const { supabaseAdmin } = require('../db/supabase');

// One coaching sentence that explains why TODAY matters in the bigger picture —
// the COACHING CONTEXT, not the workout description. Deterministic (rule-based)
// so it's instant and free; keyed on today's workout, week position, phase, and
// form (TSB). See docs/prompts-aha-moments.md prompt 7.

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

const isRest = (w) => !w || w.type === 'rest' || (w.duration_min ?? 0) === 0;
const isHard = (w) => w && (w.is_key_workout || ['threshold', 'vo2max', 'tempo'].includes(w.type) || w.intensity === 'hard');

/** A single contextual sentence for today, or null if there's no plan. */
async function getDailyContext(userId, today = new Date().toISOString().slice(0, 10)) {
  const weekStart = mondayOf(today);

  const [{ data: plan }, { data: profile }, { data: metrics }] = await Promise.all([
    supabaseAdmin.from('training_plans').select('plan_json, phase').eq('user_id', userId).eq('week_start', weekStart).maybeSingle(),
    supabaseAdmin.from('users').select('current_phase').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('performance_metrics').select('tsb').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const workouts = Array.isArray(plan?.plan_json?.workouts) ? plan.plan_json.workouts : [];
  if (!workouts.length) return null;

  const idx = new Date(`${today}T00:00:00Z`).getUTCDay();
  const todayName = DOW[idx];
  const tomorrowName = DOW[(idx + 1) % 7];
  const todayW = workouts.find((w) => w.day === todayName);
  const tomorrowW = workouts.find((w) => w.day === tomorrowName);
  const phase = (plan?.phase ?? profile?.current_phase ?? '').toLowerCase();
  const tsb = metrics?.tsb != null ? Math.round(metrics.tsb) : null;

  // Rest day.
  if (isRest(todayW)) {
    return 'Rest day — your body is processing recent load. This is where fitness is actually made.';
  }

  // Key / hard session.
  if (isHard(todayW)) {
    if (phase === 'taper') return 'A sharp effort during taper — short and sharp keeps the engine revved without adding fatigue.';
    if (tsb != null && tsb >= 5) return `Key session today. Your form is at +${tsb} — the best conditions you'll have this week. Make it count.`;
    if (tsb != null && tsb <= -20) return "Key session today, but you're carrying fatigue. Warm up well and judge it by feel.";
    return 'Key session today — this is the one that moves the needle. Don\'t skip it.';
  }

  // Easy/endurance the day before a hard effort.
  if (isHard(tomorrowW)) {
    return 'Easy day before tomorrow\'s hard effort. Keep it genuinely easy — tomorrow is where the work happens.';
  }

  // General aerobic/endurance day.
  if (phase === 'base') return "Today's easy miles build the aerobic base everything else is built on. Boring is the point.";
  return "Today's ride builds the aerobic base that makes your key sessions possible.";
}

module.exports = { getDailyContext };
