// Phase engine — determines which training phase a user is in. Runs every
// Monday and after each FTP test. One unified plan; phase is automatic.
//
//   No event  → automatic progression Base → Build → Peak → (Recovery) → Build…
//   With event → backwards planning from the event date, ending in a Taper.

const { supabaseAdmin } = require('../db/supabase');

const WEEK_MS = 7 * 24 * 3600 * 1000;
const DEFAULT_BASELINE = 300; // fallback weekly TSS when there's no history yet

// TSS target = baseline × factor (baseline = avg weekly TSS over last 4 weeks).
const TSS_FACTOR = { base: 0.9, build: 1.1, peak: 1.2, recovery: 0.6, taper: 0.55 };
const NEXT_PHASE = { base: 'build', build: 'peak', peak: 'recovery', recovery: 'build', taper: 'taper' };

const PHASE_RATIONALE = {
  base: 'Building your aerobic foundation with steady, mostly easy riding.',
  build: 'Raising your threshold and sustainable power with focused intensity.',
  peak: 'Sharpening race-specific fitness while keeping you fresh.',
  recovery: 'A lighter week so your body absorbs the training and rebounds stronger.',
  taper: 'Cutting volume before your event so you arrive fresh with a revved engine.',
};

function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}

function weeksBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / WEEK_MS);
}

/** Gather fitness signals: baseline TSS, current CTL/TSB, weeks of data. */
async function gatherSignals(userId) {
  const { data: metrics } = await supabaseAdmin
    .from('performance_metrics')
    .select('ctl, atl, tsb, tss, week_start')
    .eq('user_id', userId)
    .order('week_start', { ascending: true });

  const rows = metrics || [];
  const last4 = rows.slice(-4);
  const baseline = last4.length ? Math.round(last4.reduce((s, w) => s + (w.tss || 0), 0) / last4.length) : DEFAULT_BASELINE;
  const current = rows[rows.length - 1] || {};
  return {
    baseline: baseline > 0 ? baseline : DEFAULT_BASELINE,
    ctl: current.ctl ?? 0,
    tsb: current.tsb ?? 0,
    weeksOfData: rows.length,
  };
}

/**
 * Backwards planning from an event date.
 *   > 16 weeks out → base, 8–16 → build, 3–8 → peak, ≤ 3 → taper.
 */
function eventPath(weeksToEvent) {
  if (weeksToEvent > 16) {
    return { phase: 'base', phase_total_weeks: Math.max(1, weeksToEvent - 16), phase_week: 1, next_phase: 'build', weeks_until_next_phase: weeksToEvent - 16 };
  }
  if (weeksToEvent > 8) {
    return { phase: 'build', phase_total_weeks: 8, phase_week: 16 - weeksToEvent + 1, next_phase: 'peak', weeks_until_next_phase: weeksToEvent - 8 };
  }
  if (weeksToEvent > 3) {
    return { phase: 'peak', phase_total_weeks: 5, phase_week: 8 - weeksToEvent + 1, next_phase: 'taper', weeks_until_next_phase: weeksToEvent - 3 };
  }
  return { phase: 'taper', phase_total_weeks: 3, phase_week: 3 - Math.max(0, weeksToEvent) + 1, next_phase: 'taper', weeks_until_next_phase: Math.max(0, weeksToEvent) };
}

/**
 * Automatic progression (no event) from CTL + weeks in the current phase.
 */
function progressionPath(signals, currentPhase, weeksInPhase) {
  const { ctl, weeksOfData } = signals;

  // Not enough data or foundation → Base.
  if (weeksOfData < 4 || ctl < 50) {
    return { phase: 'base', phase_total_weeks: 6, phase_week: Math.min(6, weeksInPhase), next_phase: 'build', weeks_until_next_phase: Math.max(1, 6 - weeksInPhase) };
  }

  if (ctl <= 70) {
    if (currentPhase === 'base' && weeksInPhase < 6) {
      return { phase: 'base', phase_total_weeks: 6, phase_week: weeksInPhase, next_phase: 'build', weeks_until_next_phase: 6 - weeksInPhase };
    }
    return { phase: 'build', phase_total_weeks: 6, phase_week: currentPhase === 'build' ? weeksInPhase : 1, next_phase: 'peak', weeks_until_next_phase: Math.max(1, 6 - (currentPhase === 'build' ? weeksInPhase : 1)) };
  }

  if (ctl <= 90) {
    if (currentPhase === 'build' && weeksInPhase < 6) {
      return { phase: 'build', phase_total_weeks: 6, phase_week: weeksInPhase, next_phase: 'peak', weeks_until_next_phase: 6 - weeksInPhase };
    }
    return { phase: 'peak', phase_total_weeks: 4, phase_week: currentPhase === 'peak' ? weeksInPhase : 1, next_phase: 'recovery', weeks_until_next_phase: Math.max(1, 4 - (currentPhase === 'peak' ? weeksInPhase : 1)) };
  }

  // CTL > 90 → Peak (max 4 weeks), then Recovery and restart Build.
  if (currentPhase === 'peak' && weeksInPhase >= 4) {
    return { phase: 'recovery', phase_total_weeks: 1, phase_week: 1, next_phase: 'build', weeks_until_next_phase: 1 };
  }
  return { phase: 'peak', phase_total_weeks: 4, phase_week: currentPhase === 'peak' ? weeksInPhase : 1, next_phase: 'recovery', weeks_until_next_phase: Math.max(1, 4 - (currentPhase === 'peak' ? weeksInPhase : 1)) };
}

/**
 * determinePhase(userId): PhaseResult — and persists current_phase /
 * phase_started_at, logging transitions to phase_history.
 */
async function determinePhase(userId) {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('current_phase, phase_started_at, target_event_date, target_event_name')
    .eq('id', userId)
    .maybeSingle();

  const signals = await gatherSignals(userId);
  const today = mondayOf();
  const currentPhase = user?.current_phase ?? null;
  const phaseStarted = user?.phase_started_at ? mondayOf(new Date(user.phase_started_at)) : today;
  const weeksInPhase = Math.max(1, weeksBetween(phaseStarted, today) + 1);

  let weeks_to_event = null;
  let result;
  if (user?.target_event_date) {
    weeks_to_event = Math.ceil((new Date(user.target_event_date).getTime() - today.getTime()) / WEEK_MS);
    result = eventPath(weeks_to_event);
  } else {
    result = progressionPath(signals, currentPhase, weeksInPhase);
  }

  // Recovery overrides (skip during taper — taper is already low-volume).
  if (result.phase !== 'taper') {
    if (signals.tsb <= -20) {
      result = { ...result, phase: 'recovery', phase_total_weeks: 1, phase_week: 1, next_phase: NEXT_PHASE[currentPhase] || 'build' };
    } else if (weeksInPhase % 4 === 0) {
      // Every 4th week is a recovery week within the phase.
      result = { ...result, phase: 'recovery' };
    }
  }

  const tss_target = Math.round(signals.baseline * (TSS_FACTOR[result.phase] ?? 1));
  const rationale = PHASE_RATIONALE[result.phase];

  const phaseResult = {
    phase: result.phase,
    phase_week: result.phase_week,
    phase_total_weeks: result.phase_total_weeks,
    weeks_to_event,
    tss_target,
    rationale,
    next_phase: result.next_phase ?? NEXT_PHASE[result.phase] ?? 'build',
    weeks_until_next_phase: result.weeks_until_next_phase ?? 1,
    baseline: signals.baseline,
  };

  await persistPhase(userId, phaseResult, currentPhase, user?.target_event_date ? 'event_driven' : 'automatic');
  return phaseResult;
}

/** Persist the phase to users and log a transition row when it changes. */
async function persistPhase(userId, phaseResult, previousPhase, reason) {
  if (phaseResult.phase === previousPhase) return;

  const startedAt = mondayOf().toISOString().slice(0, 10);
  await supabaseAdmin
    .from('users')
    .update({ current_phase: phaseResult.phase, phase_started_at: startedAt })
    .eq('id', userId);

  // Close the previous open history row, then open a new one.
  if (previousPhase) {
    await supabaseAdmin
      .from('phase_history')
      .update({ ended_at: startedAt })
      .eq('user_id', userId)
      .is('ended_at', null);
  }
  await supabaseAdmin.from('phase_history').insert({ user_id: userId, phase: phaseResult.phase, started_at: startedAt, reason });
}

module.exports = { determinePhase, gatherSignals, eventPath, progressionPath, mondayOf };
