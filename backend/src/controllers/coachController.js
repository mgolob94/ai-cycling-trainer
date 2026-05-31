const aiCoach = require('../services/aiCoach');
const weeklyCheckIn = require('../services/weeklyCheckIn');
const { supabaseAdmin } = require('../db/supabase');

const COACH_MESSAGE_LIMITS = { free: 5, basic: 30, pro: Infinity };

function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

// Word-bounded so short tokens (ill, sore) don't match inside "will", "score", etc.
const INJURY_RE = /\b(injur\w*|hurt\w*|pain\w*|sore|sick|ill|crash\w*)\b/i;
const PLAN_RE = /change.*plan|adjust.*plan|new plan|rest day|skip|reschedul/i;

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

/**
 * POST /coach/message — conversational coach. Always fresh (never cached), but
 * injects the athlete context. Enforces per-plan monthly message limits.
 * Body: { message, conversationHistory: [{role, content}] }
 */
async function message(req, res, next) {
  try {
    const userId = req.user.id;
    const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!text) return res.status(400).json({ success: false, data: null, error: 'Missing message' });

    // Usage limit (reset monthly).
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('subscription_plan, coach_messages_used_this_month, coach_messages_reset_at')
      .eq('id', userId)
      .maybeSingle();
    const plan = u?.subscription_plan ?? 'free';
    const limit = COACH_MESSAGE_LIMITS[plan] ?? COACH_MESSAGE_LIMITS.free;
    let used = u?.coach_messages_used_this_month ?? 0;
    if (!u?.coach_messages_reset_at || new Date(u.coach_messages_reset_at) < new Date(startOfMonth())) {
      used = 0;
      await supabaseAdmin.from('users').update({ coach_messages_used_this_month: 0, coach_messages_reset_at: new Date().toISOString() }).eq('id', userId);
    }
    if (used >= limit) {
      return res.status(429).json({ success: false, data: { remaining: 0 }, error: 'Monthly coach message limit reached' });
    }

    const athlete = await aiCoach.gatherAthleteContext(userId);
    const system = aiCoach.buildCoachSystemPrompt(athlete);
    const history = Array.isArray(req.body?.conversationHistory)
      ? req.body.conversationHistory.slice(-10).filter((m) => m && typeof m.content === 'string')
      : [];

    const messages = [
      { role: 'system', content: system },
      {
        role: 'system',
        content:
          'You are now chatting with the athlete. Be concise — at most 3 sentences unless asked for more. Reference their actual data when relevant. If they report a problem (injury, fatigue, life event), adjust your recommendation. Respond in plain text (no JSON).',
      },
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: text },
    ];

    const { content } = await aiCoach.callOpenAI(messages, { json: false, maxTokens: 300 });

    if (Number.isFinite(limit)) {
      await supabaseAdmin.from('users').update({ coach_messages_used_this_month: used + 1 }).eq('id', userId);
    }

    // Intent detection.
    const combined = `${text}\n${content}`;
    let intent = 'info';
    let suggested = null;
    if (INJURY_RE.test(combined)) {
      intent = 'injury';
      suggested = { label: 'See recovery', screen: 'Recovery' };
    } else if (PLAN_RE.test(combined)) {
      intent = 'plan_change';
      suggested = { label: 'View plan', screen: 'TrainingPlan' };
    }

    const remaining = Number.isFinite(limit) ? Math.max(0, limit - (used + 1)) : null;
    res.json({ success: true, data: { message: content, intent, suggested_action: suggested, remaining }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { weeklyPlan, checkin, message };
