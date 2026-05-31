const plans = require('../services/plans');
const phaseEngine = require('../services/phaseEngine');
const dailyContext = require('../services/dailyContext');
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

/** GET /plans/adaptation-status — whether the latest plan was adapted + why. */
async function adaptationStatus(req, res, next) {
  try {
    const { data } = await supabaseAdmin
      .from('training_plans')
      .select('adaptation_reason')
      .eq('user_id', req.user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    res.json({ success: true, data: { adapted: !!data?.adaptation_reason, reason: data?.adaptation_reason ?? null }, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /plans/adaptation-status/dismiss — clear the adaptation reason once seen. */
async function dismissAdaptation(req, res, next) {
  try {
    await supabaseAdmin
      .from('training_plans')
      .update({ adaptation_reason: null })
      .eq('user_id', req.user.id)
      .not('adaptation_reason', 'is', null);
    res.json({ success: true, data: { cleared: true }, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /plans/daily-context — one coaching sentence about why today matters. */
async function dailyContextLine(req, res, next) {
  try {
    const context = await dailyContext.getDailyContext(req.user.id);
    res.json({ success: true, data: { context }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPlans,
  getCurrentPlan,
  generatePlan,
  getPhase,
  setEvent,
  adaptationStatus,
  dismissAdaptation,
  dailyContextLine,
};
