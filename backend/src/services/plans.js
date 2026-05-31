const { supabaseAdmin } = require('../db/supabase');
const ai = require('./ai');
// Lazy require of aiCoach to avoid any require cycle at module-load time.

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
  // The canonical, phase-aware generator lives in aiCoach. It determines the
  // current training phase, generates the week with that context, and upserts
  // the training_plans row (one unified plan system).
  const aiCoach = require('./aiCoach');
  return aiCoach.generateWeeklyPlan(userId, currentWeekStart());
}

module.exports = {
  currentWeekStart,
  getUserProfile,
  getRecentRides,
  generateAndStorePlan,
};
