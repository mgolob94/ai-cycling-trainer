const plans = require('../services/plans');
const phaseEngine = require('../services/phaseEngine');
const { supabaseAdmin } = require('../db/supabase');

async function listPlans(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('training_plans')
      .select('*')
      .eq('user_id', req.user.id)
      .order('week_start', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

async function getCurrentPlan(req, res, next) {
  try {
    const weekStart = plans.currentWeekStart();
    const { data, error } = await supabaseAdmin
      .from('training_plans')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

async function generatePlan(req, res, next) {
  try {
    const plan = await plans.generateAndStorePlan(req.user.id);
    res.status(201).json({ success: true, data: plan, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /plans/phase — the current training phase (recomputed). */
async function getPhase(req, res, next) {
  try {
    const phase = await phaseEngine.determinePhase(req.user.id);
    res.json({ success: true, data: phase, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /plans/event — set (or clear) the target event, then recompute the phase.
 * Body: { target_event_name, target_event_date } — null/omitted clears the event
 * (automatic progression). Returns the new phase result.
 */
async function setEvent(req, res, next) {
  try {
    const name = req.body?.target_event_name ?? null;
    const date = req.body?.target_event_date ?? null;
    const { error } = await supabaseAdmin
      .from('users')
      .update({ target_event_name: name, target_event_date: date })
      .eq('id', req.user.id);
    if (error) throw error;
    const phase = await phaseEngine.determinePhase(req.user.id);
    res.json({ success: true, data: phase, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPlans, getCurrentPlan, generatePlan, getPhase, setEvent };
