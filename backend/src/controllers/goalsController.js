const { supabaseAdmin } = require('../db/supabase');
const goalTracker = require('../services/goalTracker');

const GOAL_TYPES = ['ftp_target', 'event', 'consistency', 'distance', 'fitness'];

/** GET /goals — list the athlete's goals with freshly computed progress. */
async function list(req, res, next) {
  try {
    const { data: goals } = await supabaseAdmin
      .from('goals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    const withProgress = await Promise.all(
      (goals || []).map(async (g) =>
        g.status === 'active' ? { ...g, current_progress: await goalTracker.calculateGoalProgress(req.user.id, g.id) } : g
      )
    );
    res.json({ success: true, data: withProgress, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /goals — create a goal. */
async function create(req, res, next) {
  try {
    const b = req.body || {};
    if (!GOAL_TYPES.includes(b.goal_type)) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid goal_type' });
    }
    const row = {
      user_id: req.user.id,
      goal_type: b.goal_type,
      title: b.title ?? null,
      target_date: b.target_date ?? null,
      target_ftp: b.target_ftp ?? null,
      target_distance_km: b.target_distance_km ?? null,
      target_event_name: b.target_event_name ?? null,
      status: 'active',
      current_progress: 0,
    };
    const { data, error } = await supabaseAdmin.from('goals').insert(row).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /goals/:id/insight — AI assessment of whether the athlete is on track. */
async function insight(req, res, next) {
  try {
    const { data: goal } = await supabaseAdmin
      .from('goals')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (!goal) return res.status(404).json({ success: false, data: null, error: 'Goal not found' });

    const result = await goalTracker.generateGoalInsight(req.user.id, goal);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/** PATCH /goals/:id — update status (e.g. abandon / complete). */
async function update(req, res, next) {
  try {
    const status = req.body?.status;
    if (!['active', 'completed', 'abandoned'].includes(status)) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid status' });
    }
    const { data, error } = await supabaseAdmin
      .from('goals')
      .update({ status })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /goals/check-milestones — recompute progress, return crossed milestones. */
async function checkMilestones(req, res, next) {
  try {
    const crossed = await goalTracker.checkGoalMilestones(req.user.id);
    res.json({ success: true, data: { milestones: crossed }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, insight, update, checkMilestones };
