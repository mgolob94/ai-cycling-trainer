const path = require('path');

// Load the repo-root .env so test credentials come from the environment and are
// never hardcoded. (Run with real Supabase service-role creds.)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Mock the LLM so the test is deterministic and offline — we still exercise the
// real route, auth middleware, DB reads (profile + rides), and plan persistence.
jest.mock('../src/services/ai', () => ({
  generateWeeklyPlan: jest.fn(async () => ({
    week_start: '2026-06-01',
    summary: 'Deterministic test plan.',
    workouts: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({
      day,
      type: 'endurance',
      duration_min: 60,
      intensity: 'moderate',
      description: 'Steady zone 2 ride.',
    })),
  })),
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');

// Fail fast (rather than hardcoding anything) if test credentials are absent.
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(
    `Missing required env vars for the e2e test: ${missing.join(', ')}. ` +
      'Set them in the repo-root .env (never hardcode secrets).'
  );
}

const app = require('../index');
const { supabaseAdmin } = require('../src/db/supabase');
const { encrypt } = require('../src/services/encryption');

describe('e2e: training plan generation', () => {
  const testEmail = `e2e+${Date.now()}@example.test`;
  let userId;
  let accessToken;

  beforeAll(async () => {
    // 1. Create a test user in Supabase Auth (the signup trigger also creates a
    //    public.users row); then fill in the profile fields the AI input needs.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: `Test-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;

    const { error: profileError } = await supabaseAdmin.from('users').upsert({
      id: userId,
      email: testEmail,
      age: 34,
      weight_kg: 72,
      fitness_level: 'intermediate',
      goal: 'endurance',
    });
    if (profileError) throw profileError;

    // A JWT our auth middleware accepts (HS256, audience "authenticated").
    accessToken = jwt.sign(
      { sub: userId, email: testEmail, role: 'authenticated' },
      process.env.SUPABASE_JWT_SECRET,
      { audience: 'authenticated', expiresIn: '1h' }
    );

    // 2. Simulate a Strava OAuth connection with mock (encrypted) tokens.
    const { error: connError } = await supabaseAdmin.from('strava_connections').upsert(
      {
        user_id: userId,
        access_token: encrypt('mock-strava-access-token'),
        refresh_token: encrypt('mock-strava-refresh-token'),
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (connError) throw connError;

    // 3. Insert 10 mock rides within the last 4 weeks so getRecentRides finds them.
    const rides = Array.from({ length: 10 }, (_, i) => ({
      user_id: userId,
      strava_id: `e2e-${userId}-${i}`,
      distance_km: 30 + i,
      duration_sec: 3600 + i * 120,
      avg_power_w: 180 + i,
      avg_heart_rate: 140 + i,
      elevation_m: 200 + i * 15,
      ride_date: new Date(Date.now() - i * 2 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10),
    }));
    const { error: ridesError } = await supabaseAdmin.from('rides').insert(rides);
    if (ridesError) throw ridesError;
  });

  afterAll(async () => {
    // 5. Clean up all test data. Deleting the auth user cascades to
    //    public.users and its children, but we delete explicitly first to be safe.
    if (!userId) return;
    await supabaseAdmin.from('training_plans').delete().eq('user_id', userId);
    await supabaseAdmin.from('rides').delete().eq('user_id', userId);
    await supabaseAdmin.from('strava_connections').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
  });

  test('POST /api/plans/generate returns and persists a valid plan', async () => {
    // 4. Generate the plan via the real authenticated route.
    const res = await request(app)
      .post('/api/plans/generate')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const plan = res.body.data;
    expect(plan).toBeTruthy();
    expect(plan.user_id).toBe(userId);
    expect(plan.plan_json).toBeTruthy();
    expect(Array.isArray(plan.plan_json.workouts)).toBe(true);
    expect(plan.plan_json.workouts.length).toBeGreaterThanOrEqual(5);

    for (const workout of plan.plan_json.workouts) {
      expect(workout).toHaveProperty('day');
      expect(workout).toHaveProperty('type');
      expect(workout).toHaveProperty('duration_min');
      expect(workout).toHaveProperty('intensity');
      expect(workout).toHaveProperty('description');
    }

    // Verify it was persisted to training_plans.
    const { data: stored, error } = await supabaseAdmin
      .from('training_plans')
      .select('*')
      .eq('user_id', userId);
    expect(error).toBeNull();
    expect(stored.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/plans/generate requires authentication', async () => {
    const res = await request(app).post('/api/plans/generate');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
