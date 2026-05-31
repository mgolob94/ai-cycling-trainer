const { supabaseAdmin } = require('../db/supabase');

/**
 * POST /workouts/feedback — record a post-workout survey response. This is the
 * coach's learning loop; the feedback feeds buildCoachSystemPrompt.
 * Body: { workout_date, strava_activity_id, completion_status, perceived_effort,
 *         post_feeling, planned_tss, actual_tss }
 */
async function feedback(req, res, next) {
  try {
    const b = req.body || {};
    const row = {
      user_id: req.user.id,
      workout_date: b.workout_date || new Date().toISOString().slice(0, 10),
      strava_activity_id: b.strava_activity_id ?? null,
      completion_status: b.completion_status ?? null,
      perceived_effort: b.perceived_effort ?? null,
      post_feeling: b.post_feeling ?? null,
      planned_tss: b.planned_tss ?? null,
      actual_tss: b.actual_tss ?? null,
    };
    const { error } = await supabaseAdmin.from('workout_feedback').insert(row);
    if (error) throw error;
    res.json({ success: true, data: { saved: true }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { feedback };
