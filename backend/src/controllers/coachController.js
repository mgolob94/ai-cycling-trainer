const aiCoach = require('../services/aiCoach');
const weeklyCheckIn = require('../services/weeklyCheckIn');

function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return d.toISOString().slice(0, 10);
}

/** POST /coach/weekly-plan — generate (or return cached) this week's AI plan. */
async function weeklyPlan(req, res, next) {
  try {
    const weekStart = req.body?.week_start || mondayOf();
    const plan = await aiCoach.generateWeeklyPlan(req.user.id, weekStart);
    res.json({ success: true, data: plan, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /coach/checkin — mid-week or end-of-week check-in (body: { type }). */
async function checkin(req, res, next) {
  try {
    const type = req.body?.type === 'endofweek' ? 'endofweek' : 'midweek';
    const result =
      type === 'endofweek'
        ? await weeklyCheckIn.endOfWeekReview(req.user.id)
        : await weeklyCheckIn.midWeekCheckIn(req.user.id);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { weeklyPlan, checkin };
