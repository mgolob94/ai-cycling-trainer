const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const { supabaseAdmin } = require('../db/supabase');
const plans = require('../services/plans');

// Progressive onboarding saves — each step persists its own fields so an
// interrupted onboarding can resume with everything entered so far. Mounted at
// /onboarding (see index.js). All routes are owner-scoped via requireAuth.

async function updateUser(userId, fields) {
  const { error } = await supabaseAdmin.from('users').update(fields).eq('id', userId);
  if (error) throw error;
}

/** POST /onboarding/profile — age, weight, weekly availability. */
router.post('/profile', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    await updateUser(req.user.id, {
      age: b.age ?? null,
      weight_kg: b.weight_kg ?? null,
      available_days_per_week: b.available_days_per_week ?? 4,
      training_days_per_week: b.available_days_per_week ?? 4,
      preferred_long_ride_day: b.preferred_long_ride_day ?? 'saturday',
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

/** POST /onboarding/goal — goal type + optional target event. */
router.post('/goal', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    await updateUser(req.user.id, {
      goal: b.goal ?? null,
      target_event_name: b.target_event_name ?? null,
      target_event_date: b.target_event_date ?? null,
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

/** POST /onboarding/preferences — coach style + knowledge level. */
router.post('/preferences', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = {};
    if (b.coach_style) fields.coach_style = b.coach_style;
    if (b.knowledge_level) fields.knowledge_level = b.knowledge_level;
    await updateUser(req.user.id, fields);
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /onboarding/complete — mark onboarding done and kick off the first plan
 * in the background (best-effort; the dashboard shows it once ready).
 */
router.post('/complete', requireAuth, async (req, res, next) => {
  try {
    await updateUser(req.user.id, { onboarding_completed: true });
    // Fire-and-forget first plan generation — don't block the response.
    plans.generateAndStorePlan(req.user.id).catch((e) => console.warn('[onboarding] first plan skipped:', e.message));
    res.json({ success: true, data: { onboarding_completed: true }, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
