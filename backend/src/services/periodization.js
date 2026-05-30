const aiCoach = require('./aiCoach');
const { getCached, saveCache, TTL_DEFAULTS, monthKey } = require('./aiCache');

const DEFAULT_BLOCK_WEEKS = 12;

/** Whole weeks from today until the event date, or null if no/invalid date. */
function weeksUntil(eventDate) {
  if (!eventDate) return null;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const event = new Date(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(event.getTime())) return null;
  const weeks = Math.ceil((event - today) / (7 * 24 * 3600 * 1000));
  return Math.max(0, weeks);
}

/** Training phase from weeks remaining (Base → Build → Peak → Taper). */
function determinePhase(weeks) {
  if (weeks > 16) {
    return {
      key: 'base',
      name: 'Base',
      guidance: 'High volume, low intensity, Zone 2 aerobic focus. Build the aerobic engine and durability.',
    };
  }
  if (weeks >= 8) {
    return {
      key: 'build',
      name: 'Build',
      guidance: 'Progressively increase intensity with threshold (Zone 4) work and sustained efforts; keep some Z2 volume.',
    };
  }
  if (weeks >= 4) {
    return {
      key: 'peak',
      name: 'Peak',
      guidance: 'Race-specific intervals (VO2max / anaerobic), reduce overall volume, sharpen top-end fitness.',
    };
  }
  return {
    key: 'taper',
    name: 'Taper',
    guidance: 'Cut volume ~40% while maintaining intensity to shed fatigue and arrive fresh.',
  };
}

function normalizePlan(parsed, phase) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    phase_name: String(parsed.phase_name ?? phase.name),
    phase_description: String(parsed.phase_description ?? phase.guidance),
    weekly_structure: arr(parsed.weekly_structure).map((d) => ({
      day: String(d.day ?? ''),
      workout_type: String(d.workout_type ?? ''),
      duration_min: Number.isFinite(d.duration_min) ? Math.round(d.duration_min) : null,
      intensity_zone: String(d.intensity_zone ?? ''),
      notes: String(d.notes ?? ''),
    })),
    tss_target: Number.isFinite(parsed.tss_target) ? Math.round(parsed.tss_target) : null,
    key_workouts: arr(parsed.key_workouts).map((k) => ({
      name: String(k.name ?? ''),
      description: String(k.description ?? ''),
      goal: String(k.goal ?? ''),
    })),
    avoid: arr(parsed.avoid).map(String),
  };
}

/**
 * Generate a periodized one-week structure for the user's current phase.
 * userProfile: { id, goal, target_event_date, training_days_per_week, weight_kg, w_prime_total }
 * recentMetrics: weekly metrics array (last element = current CTL/ATL/TSB)
 */
async function generatePlan({ userProfile = {}, ftpHistory = [], recentMetrics = [] }) {
  const eventDate = userProfile.target_event_date ?? null;
  const weeks = weeksUntil(eventDate) ?? DEFAULT_BLOCK_WEEKS;
  const phase = determinePhase(weeks);
  const days = userProfile.training_days_per_week ?? 4;
  const current = recentMetrics[recentMetrics.length - 1] || {};

  const userId = userProfile?.id;
  const goal = userProfile.goal ?? 'general';
  const cacheKey = `period_${goal}_${monthKey()}`;
  if (userId) {
    const cached = await getCached(userId, 'periodization', cacheKey);
    if (cached.hit) {
      console.log(`[CACHE HIT] periodization for user ${userId}, ${cacheKey}`);
      return { ...cached.data, _cached: true, _generated_at: cached.generated_at };
    }
    console.log(`[CACHE MISS] Generating periodization for user ${userId}`);
  }

  const system = aiCoach.generateSystemPrompt(userProfile, ftpHistory, recentMetrics);
  const user = [
    `Design a one-week training structure for the ${phase.name} phase of this athlete's plan.`,
    `Goal: ${userProfile.goal ?? 'general fitness'}.`,
    `Weeks until target event: ${weeks}${eventDate ? ` (event on ${eventDate})` : ' (no event set — default 12-week block)'}.`,
    `Available training days per week: ${days}.`,
    `Current fitness: CTL ${Math.round(current.ctl ?? 0)}, ATL ${Math.round(current.atl ?? 0)}, TSB ${Math.round(current.tsb ?? 0)}.`,
    `Phase guidance: ${phase.guidance}`,
    '',
    `Cover all 7 days (Mon–Sun): ${days} training days and the rest as recovery/rest. Respond with JSON only:`,
    '{ "phase_name": string, "phase_description": string, ' +
      '"weekly_structure": [{ "day": string, "workout_type": string, "duration_min": number, "intensity_zone": string, "notes": string }], ' +
      '"tss_target": number (weekly TSS), "key_workouts": [{ "name": string, "description": string, "goal": string }], "avoid": string[] }',
  ].join('\n');

  const { content, tokens } = await aiCoach.callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true, maxTokens: 900 }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON for the periodization plan');
  }

  const plan = {
    phase: phase.key,
    weeks_remaining: weeks,
    target_event_date: eventDate,
    training_days_per_week: days,
    ...normalizePlan(parsed, phase),
  };

  await aiCoach.saveInsight(userId, 'periodization', plan);
  if (userId) {
    await saveCache(userId, 'periodization', cacheKey, plan, tokens, 'gpt-4o', TTL_DEFAULTS.periodization);
  }
  return { ...plan, _cached: false };
}

module.exports = { weeksUntil, determinePhase, generatePlan };
