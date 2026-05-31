/* eslint-disable no-console */
// Seed Supabase with realistic mock data for a test user.
//   node scripts/seedMockData.js   (or: npm --prefix backend run seed)
//
// Reuses the real backend algorithms (metrics / FTP / records / recovery) so the
// seeded data is internally consistent with production.

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env') });

const { supabaseAdmin } = require(path.join(BACKEND, 'src', 'db', 'supabase'));
const metrics = require(path.join(BACKEND, 'src', 'services', 'metrics'));
const records = require(path.join(BACKEND, 'src', 'services', 'records'));
const recoveryScore = require(path.join(BACKEND, 'src', 'services', 'recoveryScore'));
const gen = require(path.join(__dirname, 'lib', 'mockGenerators'));

const TEST_EMAIL = 'test@cycling.app';
const TEST_PASSWORD = 'Test1234!';

function mondayOf(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return x.toISOString().slice(0, 10);
}

async function getOrCreateUser() {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (!error && created?.user) return created.user.id;

  // Already exists — find it.
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = data.users.find((u) => u.email === TEST_EMAIL);
  if (!found) throw new Error(`Could not create or find ${TEST_EMAIL}: ${error?.message}`);
  return found.id;
}

const USER_TABLES = [
  'rides',
  'hrv_readings',
  'sleep_sessions',
  'recovery_scores',
  'performance_metrics',
  'ftp_tests',
  'training_plans',
  'personal_records',
  'power_duration_bests',
];

async function clearUserData(userId) {
  for (const table of USER_TABLES) {
    await supabaseAdmin.from(table).delete().eq('user_id', userId);
  }
}

async function main() {
  const user = gen.generateUser();
  const userId = await getOrCreateUser();
  console.log(`✓ Test user ready: ${TEST_EMAIL}`);

  await clearUserData(userId);

  // Profile
  await supabaseAdmin.from('users').upsert({
    id: userId,
    email: TEST_EMAIL,
    age: user.age,
    weight_kg: user.weight_kg,
    fitness_level: 'intermediate',
    goal: user.goal,
    knowledge_level: user.knowledge_level,
  });

  // Rides (6 months)
  const rides = gen.generateRides(180);
  const now = new Date().toISOString();
  await supabaseAdmin.from('rides').insert(
    rides.map((r) => ({ user_id: userId, ...r, is_processed: true, synced_at: now }))
  );
  console.log(`✓ ${rides.length} rides inserted (6 months)`);

  // Power-duration bests (max per duration across rides) → records / rider type.
  const bestByDur = new Map();
  for (const r of rides) {
    for (const [d, w] of Object.entries(r.power_curve || {})) {
      const dur = Number(d);
      if (!bestByDur.has(dur) || w > bestByDur.get(dur).power) bestByDur.set(dur, { power: w, date: r.ride_date });
    }
  }
  if (bestByDur.size) {
    await supabaseAdmin.from('power_duration_bests').upsert(
      [...bestByDur.entries()].map(([duration_sec, v]) => ({
        user_id: userId,
        duration_sec,
        power_watts: v.power,
        achieved_date: v.date,
      })),
      { onConflict: 'user_id,duration_sec' }
    );
  }

  // FTP history (3 tests)
  await supabaseAdmin.from('ftp_tests').insert(
    gen.generateFTPHistory().map((f) => ({
      user_id: userId,
      ftp_watts: f.ftp_watts,
      weight_kg: user.weight_kg,
      watts_per_kg: f.watts_per_kg,
      test_date: f.test_date,
      notes: 'Mock FTP test',
    }))
  );

  // CTL/ATL/TSB across full history + personal records (real algorithms).
  await metrics.calculateFullHistory(userId);
  await records.scanAndUpsert(userId);
  const { data: pm } = await supabaseAdmin
    .from('performance_metrics')
    .select('ctl, atl, tsb')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log(`✓ CTL: ${Math.round(pm?.ctl ?? 0)}, ATL: ${Math.round(pm?.atl ?? 0)}, TSB: ${pm?.tsb >= 0 ? '+' : ''}${Math.round(pm?.tsb ?? 0)}`);

  // HRV + sleep (30 days)
  const hrv = gen.generateHRV(30);
  const sleep = gen.generateSleep(30);
  await supabaseAdmin.from('hrv_readings').insert(hrv.map((h) => ({ user_id: userId, ...h })));
  await supabaseAdmin.from('sleep_sessions').insert(sleep.map((s) => ({ user_id: userId, ...s })));
  const avgHrv = Math.round(hrv.reduce((s, h) => s + h.hrv_ms, 0) / hrv.length);
  const avgSleep = Math.round(sleep.reduce((s, x) => s + x.duration_min, 0) / sleep.length);
  console.log(`✓ 30 HRV readings inserted (baseline: ${avgHrv}ms)`);
  console.log(`✓ 30 sleep sessions inserted (avg: ${Math.floor(avgSleep / 60)}h ${avgSleep % 60}min)`);

  // Recovery scores (30 days, real algorithm)
  for (let i = 0; i < 30; i += 1) {
    const date = gen.daysAgoDate(i);
    await recoveryScore.calculateRecoveryScore(userId, date).catch(() => {});
  }
  console.log('✓ 30 recovery scores calculated');

  // Training plan for the current week
  const weekStart = mondayOf(new Date());
  const planJson = {
    week_start: weekStart,
    summary: 'Build week — sweet spot focus with one interval session.',
    workouts: [
      { day: 'Monday', type: 'rest', duration_min: 0, intensity: 'easy', description: 'Rest day.' },
      { day: 'Tuesday', type: 'intervals', duration_min: 75, intensity: 'hard', description: '4x8min sweet spot (88–93% FTP).' },
      { day: 'Wednesday', type: 'endurance', duration_min: 90, intensity: 'easy', description: 'Zone 2 endurance.' },
      { day: 'Thursday', type: 'intervals', duration_min: 70, intensity: 'hard', description: '5x5min VO2max.' },
      { day: 'Friday', type: 'recovery', duration_min: 45, intensity: 'easy', description: 'Easy spin.' },
      { day: 'Saturday', type: 'endurance', duration_min: 150, intensity: 'moderate', description: 'Long ride with tempo blocks.' },
      { day: 'Sunday', type: 'endurance', duration_min: 90, intensity: 'easy', description: 'Zone 2 endurance.' },
    ],
  };
  await supabaseAdmin
    .from('training_plans')
    .upsert({ user_id: userId, week_start: weekStart, plan_json: planJson, generated_at: now }, { onConflict: 'user_id,week_start' });
  console.log('✓ Training plan for this week ready');

  console.log(`\n  Login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  });
