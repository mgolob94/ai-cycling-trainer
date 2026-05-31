const rideFeedback = require('../services/rideFeedback');

/**
 * POST /workouts/feedback — record a post-workout survey response. This is the
 * coach's learning loop; the feedback feeds buildCoachSystemPrompt. Delegates to
 * rideFeedback.recordFeedback (upsert + AI feedback). Prefer the canonical
 * POST /api/rides/:strava_id/feedback when a ride id is known.
 * Body: { workout_date, strava_activity_id, completion_status, perceived_effort,
 *         post_feeling, planned_tss, actual_tss }
 */
async function feedback(req, res, next) {
  try {
    const b = req.body || {};
    const result = await rideFeedback.recordFeedback(req.user.id, b.strava_activity_id ?? null, b);
    res.json({ success: true, data: { saved: true, ...result }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { feedback };
