const axios = require('axios');

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o';

/**
 * Build the prompt sent to the LLM. Kept here so plan-generation logic and the
 * prompt that drives it live in one place.
 */
function buildPlanPrompt(profile, rideSummary) {
  return [
    {
      role: 'system',
      content:
        'You are an expert cycling coach. Generate a structured one-week training plan ' +
        'tailored to the athlete. Respond with JSON only, matching this shape: ' +
        '{ "week_start": "YYYY-MM-DD", "workouts": [ { "day": "Monday", "type": "endurance|interval|recovery|rest", ' +
        '"duration_min": number, "target": "string", "notes": "string" } ] }. ' +
        'Balance load against the athlete\'s recent volume and respect their goal.',
    },
    {
      role: 'user',
      content: JSON.stringify({ profile, recent_rides: rideSummary }),
    },
  ];
}

/** Summarize recent rides into compact aggregates for the prompt. */
function summarizeRides(rides) {
  if (!rides.length) {
    return { count: 0, note: 'No recent rides available.' };
  }

  const total = rides.reduce(
    (acc, r) => ({
      distance_km: acc.distance_km + (r.distance_km || 0),
      duration_sec: acc.duration_sec + (r.duration_sec || 0),
      power: acc.power + (r.avg_power_w || 0),
      powerCount: acc.powerCount + (r.avg_power_w ? 1 : 0),
    }),
    { distance_km: 0, duration_sec: 0, power: 0, powerCount: 0 }
  );

  return {
    count: rides.length,
    total_distance_km: Math.round(total.distance_km),
    total_hours: Math.round((total.duration_sec / 3600) * 10) / 10,
    avg_power_w: total.powerCount ? Math.round(total.power / total.powerCount) : null,
    rides_per_week: Math.round((rides.length / 4) * 10) / 10,
  };
}

/**
 * Generate a weekly training plan. Returns the parsed plan JSON ready to store
 * in training_plans.plan_json.
 */
async function generateWeeklyPlan(profile, rides) {
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

  const content = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

module.exports = { buildPlanPrompt, summarizeRides, generateWeeklyPlan };
