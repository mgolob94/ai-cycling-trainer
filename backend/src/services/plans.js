const { supabaseAdmin } = require('../db/supabase');
const ai = require('./ai');

/** Monday of the current week as an ISO date string (YYYY-MM-DD). */
function currentWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Load the user profile used as AI input. */
async function getUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('age, weight_kg, fitness_level, goal')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/** Load the last 4 weeks of rides for AI input. */
async function getRecentRides(userId) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('user_id', userId)
    .gte('ride_date', fourWeeksAgo.toISOString().slice(0, 10))
    .order('ride_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Generate a fresh weekly plan from the user's profile + recent rides and
 * persist it to training_plans.
 */
async function generateAndStorePlan(userId) {
  const [profile, rides] = await Promise.all([
    getUserProfile(userId),
    getRecentRides(userId),
  ]);

  const planJson = await ai.generateWeeklyPlan(profile, rides);

  // The model doesn't reliably know today's date, so compute week_start
  // server-side and normalize the stored JSON to match.
  const weekStart = currentWeekStart();
  planJson.week_start = weekStart;

  // Upsert so regenerating ("Generate new plan") replaces the current week's
  // plan instead of colliding with the (user_id, week_start) unique constraint.
  const { data, error } = await supabaseAdmin
    .from('training_plans')
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        plan_json: planJson,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  currentWeekStart,
  getUserProfile,
  getRecentRides,
  generateAndStorePlan,
};
