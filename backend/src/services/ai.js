const axios = require('axios');

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o';

// Shape we ask the model to return. Documented once here and referenced in the
// prompt so the contract and the parser stay in sync.
const PLAN_SCHEMA_HINT = `{
  "week_start": "YYYY-MM-DD (the upcoming Monday)",
  "summary": "one or two sentences on the week's focus",
  "workouts": [
    {
      "day": "Monday",
      "type": "endurance | intervals | tempo | recovery | rest",
      "duration_min": number,
      "intensity": "easy | moderate | hard",
      "description": "what to do and why, in 1-2 sentences"
    }
  ]
}`;

/**
 * Summarize recent rides into compact aggregates so the prompt carries signal
 * (volume, frequency, power) without dumping every row at the model.
 */
function summarizeRides(rides) {
  if (!rides.length) {
    return { count: 0, note: 'No rides recorded in the last 4 weeks.' };
  }

  const total = rides.reduce(
    (acc, r) => ({
      distance_km: acc.distance_km + (r.distance_km || 0),
      duration_sec: acc.duration_sec + (r.duration_sec || 0),
      elevation_m: acc.elevation_m + (r.elevation_m || 0),
      power: acc.power + (r.avg_power_w || 0),
      powerCount: acc.powerCount + (r.avg_power_w ? 1 : 0),
    }),
    { distance_km: 0, duration_sec: 0, elevation_m: 0, power: 0, powerCount: 0 }
  );

  const longestRideKm = rides.reduce(
    (max, r) => Math.max(max, r.distance_km || 0),
    0
  );

  return {
    count: rides.length,
    rides_per_week: Math.round((rides.length / 4) * 10) / 10,
    total_distance_km: Math.round(total.distance_km),
    total_hours: Math.round((total.duration_sec / 3600) * 10) / 10,
    total_elevation_m: Math.round(total.elevation_m),
    avg_power_w: total.powerCount ? Math.round(total.power / total.powerCount) : null,
    longest_ride_km: Math.round(longestRideKm),
  };
}

/**
 * Build the chat messages sent to the model. Includes the athlete's stats and a
 * summary of their recent riding, plus an explicit JSON contract.
 */
function buildPlanPrompt(profile, rideSummary) {
  const system = [
    'You are an expert cycling coach who designs weekly training plans.',
    'Use the athlete profile and their recent ride summary to set appropriate volume and intensity.',
    'Progress load sensibly from recent volume — do not jump too hard, and include adequate recovery.',
    'The plan must cover one week with 5 to 6 workouts (the remaining days are implicit rest).',
    'Tailor the plan to the athlete\'s stated goal and fitness level.',
    'Respond with JSON only — no prose, no markdown — matching exactly this shape:',
    PLAN_SCHEMA_HINT,
  ].join('\n');

  const user = [
    'Athlete profile:',
    `- Age: ${profile.age ?? 'unknown'}`,
    `- Weight: ${profile.weight_kg ?? 'unknown'} kg`,
    `- Fitness level: ${profile.fitness_level ?? 'unknown'}`,
    `- Goal: ${profile.goal ?? 'general fitness'}`,
    '',
    'Recent riding (last 4 weeks):',
    JSON.stringify(rideSummary, null, 2),
    '',
    'Generate the plan for the upcoming week.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Generate a weekly training plan from a user profile and recent rides.
 * Returns the parsed plan JSON ready to store in training_plans.plan_json.
 */
async function generateWeeklyPlan(profile, rides) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const rideSummary = summarizeRides(rides);
  const messages = buildPlanPrompt(profile, rideSummary);

  const { data } = await axios.post(
    `${OPENAI_API_BASE}/chat/completions`,
    {
      model: MODEL,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.4,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  let plan;
  try {
    plan = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON for the training plan');
  }

  if (!Array.isArray(plan.workouts) || plan.workouts.length === 0) {
    throw new Error('Generated plan is missing workouts');
  }

  return plan;
}

module.exports = { buildPlanPrompt, summarizeRides, generateWeeklyPlan };
