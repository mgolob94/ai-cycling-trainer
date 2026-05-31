const path = require('path');
const axios = require('axios');

// Mock server for external APIs (Strava / Garmin / Whoop / OpenAI). Active only
// when NODE_ENV=development AND MOCK_EXTERNAL_APIS=true. Attaches an
// axios-mock-adapter to the default axios instance with passthrough, so only the
// intercepted hosts are mocked (Supabase uses supabase-js and is unaffected).

const gen = require(path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'mockGenerators'));

let openAiCalls = 0;

function stravaActivities() {
  return gen.generateRides(180).map((r, i) => ({
    id: 1000000 + i,
    name: 'Mock Ride',
    type: 'Ride',
    distance: Math.round(r.distance_km * 1000),
    moving_time: r.duration_sec,
    elapsed_time: r.duration_sec,
    average_watts: r.avg_power_w,
    average_heartrate: r.avg_heart_rate,
    total_elevation_gain: r.elevation_m,
    start_date: `${r.ride_date}T08:00:00Z`,
    start_date_local: `${r.ride_date}T08:00:00Z`,
  }));
}

function wattsStream(seconds = 3600, base = 210) {
  const out = [];
  for (let i = 0; i < seconds; i += 1) out.push(Math.max(0, Math.round(base + Math.sin(i / 60) * 30 + (Math.random() - 0.5) * 25)));
  return out;
}

const MOCK_PLAN = {
  week_start: gen.daysAgoDate(0),
  summary: 'Build week — sweet spot focus with one interval session.',
  workouts: [
    { day: 'Monday', type: 'rest', duration_min: 0, intensity: 'easy', description: 'Rest day.' },
    { day: 'Tuesday', type: 'intervals', duration_min: 75, intensity: 'hard', description: '4x8min sweet spot.' },
    { day: 'Wednesday', type: 'endurance', duration_min: 90, intensity: 'easy', description: 'Zone 2 endurance.' },
    { day: 'Thursday', type: 'intervals', duration_min: 70, intensity: 'hard', description: '5x5min VO2max.' },
    { day: 'Friday', type: 'recovery', duration_min: 45, intensity: 'easy', description: 'Easy spin.' },
    { day: 'Saturday', type: 'endurance', duration_min: 150, intensity: 'moderate', description: 'Long ride.' },
  ],
};

const MOCK_ANALYSIS = {
  summary: 'Solid, consistent week with good aerobic volume and one quality session. Fitness is trending up while fatigue stays manageable.',
  warning: null,
};

function openAiReply(config) {
  openAiCalls += 1;
  console.log(`[MOCK OpenAI] Call #${openAiCalls} — saved ~$0.02`);
  const body = String(config.data || '');
  // Plan prompts mention "workouts"/"week_start"; everything else is analysis.
  const content = /workouts|week_start/i.test(body) ? JSON.stringify(MOCK_PLAN) : JSON.stringify(MOCK_ANALYSIS);
  const response = {
    id: 'mock-cmpl',
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { total_tokens: 0 },
  };
  // 500ms artificial latency.
  return new Promise((resolve) => setTimeout(() => resolve([200, response]), 500));
}

/** Install the mock adapter if enabled. Safe to call unconditionally. */
function install() {
  if (process.env.NODE_ENV !== 'development' || process.env.MOCK_EXTERNAL_APIS !== 'true') return false;

  // eslint-disable-next-line global-require
  const MockAdapter = require('axios-mock-adapter');
  const mock = new MockAdapter(axios, { onNoMatch: 'passthrough' });
  const log = (label) => (config) => {
    console.log(`[MOCK API] ${label} ${config.url}`);
    return undefined;
  };

  // --- Strava (order: specific paths first) ---
  mock.onGet(/\/api\/v3\/athlete\/activities/).reply((config) => {
    log('Strava activities')(config);
    const page = Number(config.params?.page || 1);
    const perPage = Number(config.params?.per_page || 30);
    const all = stravaActivities();
    return [200, all.slice((page - 1) * perPage, page * perPage)];
  });
  mock.onGet(/\/api\/v3\/activities\/\d+\/streams/).reply((config) => {
    log('Strava streams')(config);
    return [200, { watts: { data: wattsStream() } }];
  });
  mock.onGet(/\/api\/v3\/athlete($|\?)/).reply((config) => {
    log('Strava athlete')(config);
    return [200, { id: 12345, firstname: 'Test', lastname: 'Cyclist' }];
  });

  // --- Garmin ---
  mock.onGet(/\/wellness-api\/rest\/dailies/).reply((config) => {
    log('Garmin dailies')(config);
    const today = gen.daysAgoDate(0);
    return [200, [{ calendarDate: today, restingHeartRateInBeatsPerMinute: 48, averageStressLevel: 32, maxBodyBattery: 72 }]];
  });
  mock.onGet(/\/wellness-api\/rest\/sleeps/).reply((config) => {
    log('Garmin sleeps')(config);
    const s = gen.generateSleep(1)[0];
    return [
      200,
      [
        {
          calendarDate: s.date,
          sleepTimeSeconds: s.duration_min * 60,
          deepSleepSeconds: s.deep_min * 60,
          remSleepSeconds: s.rem_min * 60,
          lightSleepSeconds: s.light_min * 60,
          awakeSleepSeconds: s.awake_min * 60,
          sleepScores: { overall: { value: s.sleep_score } },
        },
      ],
    ];
  });

  // --- Whoop ---
  mock.onGet(/\/v1\/recovery/).reply((config) => {
    log('Whoop recovery')(config);
    const h = gen.generateHRV(1)[0];
    return [
      200,
      { records: [{ created_at: h.recorded_at, score: { recovery_score: 72, hrv_rmssd_milli: h.hrv_ms, resting_heart_rate: h.resting_hr, user_calibrating: false } }] },
    ];
  });

  // --- OpenAI ---
  mock.onPost(/openai\.com\/v1\/chat\/completions/).reply(openAiReply);

  console.log('[MOCK API] External API mocking enabled (Strava / Garmin / Whoop / OpenAI)');
  return true;
}

module.exports = { install };
