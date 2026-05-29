const plans = require('../services/plans');
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

module.exports = { listPlans, getCurrentPlan, generatePlan };
