const axios = require('axios');
const { supabaseAdmin } = require('../db/supabase');
const { summarizeRides } = require('./ai');
const { getCached, saveCache, TTL_DEFAULTS, isoWeek, monthKey } = require('./aiCache');

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o';

// ---------------------------------------------------------------------------
// OpenAI helper (maps provider failures to a 502 statusCode)
// ---------------------------------------------------------------------------
async function callOpenAI(messages, { json = false, maxTokens = 450, temperature = 0.5 } = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  try {
    const { data } = await axios.post(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned an empty response');
    return { content, tokens: data.usage?.total_tokens ?? null };
  } catch (err) {
    if (err.statusCode) throw err;
    const providerMessage = err.response?.data?.error?.message || err.message;
    const wrapped = new Error(`AI provider request failed: ${providerMessage}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }
}

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------
function sortedFtp(ftpHistory) {
  return (Array.isArray(ftpHistory) ? ftpHistory : [])
    .filter((f) => f && f.ftp_watts != null)
    .sort((a, b) => String(a.test_date).localeCompare(String(b.test_date)));
}

function latestFtp(ftpHistory) {
  const arr = sortedFtp(ftpHistory);
  return arr.length ? arr[arr.length - 1] : null;
}

/** improving / plateauing / declining from first vs latest FTP. */
function describeFtpTrend(ftpHistory) {
  const arr = sortedFtp(ftpHistory);
  if (arr.length < 2) return 'unknown (needs more than one FTP test)';
  const first = arr[0].ftp_watts;
  const last = arr[arr.length - 1].ftp_watts;
  const pct = ((last - first) / first) * 100;
  if (pct >= 2) return `improving (+${pct.toFixed(1)}% over ${arr.length} tests)`;
  if (pct <= -2) return `declining (${pct.toFixed(1)}% over ${arr.length} tests)`;
  return 'plateauing (stable across tests)';
}

/** Plain-language fitness/fatigue/form description from CTL/ATL/TSB. */
function describeFitnessState(ctl, atl, tsb) {
  if (ctl == null || tsb == null) return 'Fitness state unknown (not enough training data yet).';
  const base = ctl < 30 ? 'a developing aerobic base' : ctl < 60 ? 'a solid aerobic base' : 'a strong aerobic base';
  let form;
  if (tsb > 10) form = 'fresh and well-rested';
  else if (tsb > 5) form = 'fresh';
  else if (tsb >= -10) form = 'balanced and close to race-ready';
  else if (tsb >= -30) form = 'fatigued from recent training but still productive';
  else form = 'heavily fatigued and overreaching';
  return `You currently have ${base} (CTL ${Math.round(ctl)}) and are ${form} (TSB ${Math.round(tsb)}, ATL ${Math.round(atl ?? 0)}).`;
}

function avgWeeklyTss(metrics, n = 4) {
  const arr = (Array.isArray(metrics) ? metrics : [metrics]).filter(Boolean);
  const recent = arr.slice(-n);
  if (!recent.length) return 0;
  return Math.round(recent.reduce((s, w) => s + (w.tss || 0), 0) / recent.length);
}

// ---------------------------------------------------------------------------
// 1. System prompt
// ---------------------------------------------------------------------------
function generateSystemPrompt(userProfile = {}, ftpHistory = [], recentMetrics = []) {
  const metrics = (Array.isArray(recentMetrics) ? recentMetrics : [recentMetrics]).filter(Boolean);
  const latest = metrics[metrics.length - 1] || {};
  const ftp = latestFtp(ftpHistory);
  const weight = userProfile.weight_kg;
  const wkg =
    ftp && weight ? (ftp.ftp_watts / weight).toFixed(2) : ftp?.watts_per_kg ?? null;

  return [
    'You are an elite, professional cycling coach with deep expertise in power-based training,',
    'the Performance Management Chart (CTL/ATL/TSB), and periodization. You coach this specific athlete.',
    '',
    'ATHLETE PROFILE:',
    `- Age: ${userProfile.age ?? 'unknown'}`,
    `- Weight: ${weight ?? 'unknown'} kg`,
    `- FTP: ${ftp?.ftp_watts ?? 'unknown'} W`,
    `- W' (anaerobic work capacity): ${userProfile.w_prime_total ?? 20000} J`,
    `- Power-to-weight: ${wkg ?? 'unknown'} W/kg`,
    `- Self-reported fitness level: ${userProfile.fitness_level ?? 'unknown'}`,
    `- Goal: ${userProfile.goal ?? 'general fitness'}`,
    '',
    'CURRENT FITNESS STATE:',
    `- ${describeFitnessState(latest.ctl, latest.atl, latest.tsb)}`,
    `- FTP trend: ${describeFtpTrend(ftpHistory)}`,
    `- Recent load: averaging ${avgWeeklyTss(metrics)} TSS per week over the last 4 weeks.`,
    '',
    'COACHING PHILOSOPHY:',
    '- Progressive overload: build training load gradually (~5-8% per week) with a recovery week every 3-4 weeks.',
    '- Polarized / 80-20 training: roughly 80% of riding easy (below threshold), ~20% hard (threshold and above).',
    '- Respect fatigue: avoid pushing TSB deeply negative (< -30) unless deliberately peaking for an event.',
    '',
    'INSTRUCTIONS:',
    '- Respond as a professional cycling coach: confident, specific, and supportive.',
    '- Always cite concrete numbers (TSS, watts, W/kg, CTL/TSB) and always give the reason behind each recommendation.',
    '- Tailor every recommendation to the athlete\'s goal and current fitness state.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 2. Weekly analysis
// ---------------------------------------------------------------------------
function normalizeWeek(parsed, weekMetrics) {
  const tsb = weekMetrics?.tsb;
  const allowed = ['fresh', 'optimal', 'fatigued', 'overreaching'];
  const fromTsb =
    tsb == null ? 'optimal' : tsb > 5 ? 'fresh' : tsb >= -10 ? 'optimal' : tsb >= -30 ? 'fatigued' : 'overreaching';
  const formStatus = allowed.includes(parsed.form_status) ? parsed.form_status : fromTsb;

  let warning = parsed.warning ?? null;
  if (!warning && tsb != null && tsb < -30) {
    warning = `TSB is ${Math.round(tsb)} — you're deep into overreaching. Prioritize recovery this week to avoid burnout or injury.`;
  }

  return {
    summary: String(parsed.summary ?? ''),
    form_status: formStatus,
    key_insight: String(parsed.key_insight ?? ''),
    recommendation: String(parsed.recommendation ?? ''),
    next_week_tss_target: Number.isFinite(parsed.next_week_tss_target)
      ? Math.round(parsed.next_week_tss_target)
      : null,
    warning,
  };
}

async function analyzeWeek(userProfile, weekMetrics, rides, ftpData) {
  const userId = userProfile?.id;
  const cacheKey = `week_${isoWeek()}`;

  if (userId) {
    const cached = await getCached(userId, 'weekly_summary', cacheKey);
    if (cached.hit) {
      console.log(`[CACHE HIT] weekly_summary for user ${userId}, ${cacheKey}`);
      return { ...cached.data, _cached: true, _generated_at: cached.generated_at };
    }
    console.log(`[CACHE MISS] Generating weekly_summary for user ${userId}`);
  }

  const system = generateSystemPrompt(userProfile, ftpData, weekMetrics);
  const user = [
    'Analyze this training week. Respond with JSON only, exactly this shape:',
    '{ "summary": string (2-3 sentences), "form_status": "fresh"|"optimal"|"fatigued"|"overreaching", ' +
      '"key_insight": string (one specific observation), "recommendation": string (one actionable next step), ' +
      '"next_week_tss_target": number, "warning": string|null }',
    '',
    `Week metrics: ${JSON.stringify(weekMetrics)}`,
    `Rides summary: ${JSON.stringify(summarizeRides(rides || []))}`,
  ].join('\n');

  const { content, tokens } = await callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true, maxTokens: 450 }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON for the week analysis');
  }

  const result = normalizeWeek(parsed, weekMetrics);
  await saveInsight(userId, 'week', result);
  if (userId) {
    await saveCache(userId, 'weekly_summary', cacheKey, result, tokens, MODEL, TTL_DEFAULTS.weekly_summary);
  }
  return { ...result, _cached: false };
}

// ---------------------------------------------------------------------------
// 3. Long-term trend analysis
// ---------------------------------------------------------------------------
async function analyzeTrend(userProfile, last12WeeksMetrics, ftpHistory) {
  const userId = userProfile?.id;
  const cacheKey = `trend_${monthKey()}`;

  if (userId) {
    const cached = await getCached(userId, 'trend_analysis', cacheKey);
    if (cached.hit) {
      console.log(`[CACHE HIT] trend_analysis for user ${userId}, ${cacheKey}`);
      return { ...cached.data, _cached: true, _generated_at: cached.generated_at };
    }
    console.log(`[CACHE MISS] Generating trend_analysis for user ${userId}`);
  }

  const system = generateSystemPrompt(userProfile, ftpHistory, last12WeeksMetrics);
  const user = [
    'Analyze the athlete\'s last 12 weeks of training and FTP history. Respond with JSON only:',
    '{ "trend": "improving"|"plateauing"|"declining", "explanation": string, "recommendations": string[] }',
    '',
    `Weekly metrics (oldest first): ${JSON.stringify(last12WeeksMetrics)}`,
    `FTP history (oldest first): ${JSON.stringify(ftpHistory)}`,
  ].join('\n');

  const { content, tokens } = await callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true, maxTokens: 550 }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON for the trend analysis');
  }

  const allowed = ['improving', 'plateauing', 'declining'];
  const result = {
    trend: allowed.includes(parsed.trend) ? parsed.trend : 'plateauing',
    explanation: String(parsed.explanation ?? ''),
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : [],
  };

  await saveInsight(userId, 'trend', result);
  if (userId) {
    await saveCache(userId, 'trend_analysis', cacheKey, result, tokens, MODEL, TTL_DEFAULTS.trend_analysis);
  }
  return { ...result, _cached: false };
}

// ---------------------------------------------------------------------------
// Single-ride analysis
// ---------------------------------------------------------------------------
async function analyzeRide({ userProfile = {}, ftpHistory = [], ride = {}, power = {}, zones = [], wprime = {} }) {
  const userId = userProfile?.id;
  const cacheKey = `ride_${ride.strava_id}`;

  if (userId && ride.strava_id) {
    const cached = await getCached(userId, 'ride_analysis', cacheKey);
    if (cached.hit) {
      console.log(`[CACHE HIT] ride_analysis for user ${userId}, ${cacheKey}`);
      return { ...cached.data, _cached: true, _generated_at: cached.generated_at };
    }
    console.log(`[CACHE MISS] Generating ride_analysis for user ${userId}`);
  }

  const system = generateSystemPrompt(userProfile, ftpHistory, []);

  const stats =
    `Distance ${ride.distance_km ?? '?'} km, ${Math.round((ride.duration_sec || 0) / 60)} min, ` +
    `avg power ${ride.avg_power_w ?? '?'} W, NP ${power.normalized_power ?? '?'} W, ` +
    `xPower ${power.xpower ?? '?'} W, VI ${power.variability_index ?? '?'}, ` +
    `EF ${power.efficiency_factor ?? '?'}, avg HR ${ride.avg_heart_rate ?? '?'} bpm, ` +
    `elevation ${ride.elevation_m ?? '?'} m`;
  const zoneStr = zones.map((z) => `${z.zone}/${z.label} ${z.pct}%`).join(', ');
  const wpStr =
    `min W' balance ${wprime.min_w_prime_balance ?? '?'} J, ` +
    `depletion ${wprime.w_prime_depletion_percent ?? '?'}%, matches burned ${wprime.match_count ?? '?'}`;

  const user = [
    'Analyze this single ride and respond with JSON only, exactly this shape:',
    '{ "ride_summary": string, "execution_score": number (1-10, how well the session was executed), ' +
      '"power_zones_feedback": string, "top_moment": string, "improvement_tip": string, ' +
      '"fatigue_impact": "low"|"medium"|"high" }',
    '',
    `Ride stats: ${stats}`,
    `Power distribution (% time per zone): ${zoneStr}`,
    `W' depletion profile: ${wpStr}`,
  ].join('\n');

  const { content, tokens } = await callOpenAI(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true, maxTokens: 500 }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned invalid JSON for the ride analysis');
  }

  const fatigue = ['low', 'medium', 'high'].includes(parsed.fatigue_impact)
    ? parsed.fatigue_impact
    : 'medium';
  let score = Number(parsed.execution_score);
  score = Number.isFinite(score) ? Math.max(1, Math.min(10, Math.round(score))) : null;

  const result = {
    ride_summary: String(parsed.ride_summary ?? ''),
    execution_score: score,
    power_zones_feedback: String(parsed.power_zones_feedback ?? ''),
    top_moment: String(parsed.top_moment ?? ''),
    improvement_tip: String(parsed.improvement_tip ?? ''),
    fatigue_impact: fatigue,
  };

  if (userId && ride.strava_id) {
    await saveCache(userId, 'ride_analysis', cacheKey, result, tokens, MODEL, TTL_DEFAULTS.ride_analysis);
  }
  return { ...result, _cached: false };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
async function saveInsight(userId, insightType, content) {
  if (!userId) return;
  const { error } = await supabaseAdmin
    .from('ai_insights')
    .insert({ user_id: userId, insight_type: insightType, content_json: content });
  if (error) console.warn('[aiCoach] could not store insight:', error.message);
}

module.exports = {
  generateSystemPrompt,
  analyzeWeek,
  analyzeTrend,
  analyzeRide,
  callOpenAI,
  saveInsight,
  // exported for testing / reuse
  describeFitnessState,
  describeFtpTrend,
  avgWeeklyTss,
};
