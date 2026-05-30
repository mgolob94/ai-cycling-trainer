const ai = require('../services/ai');

/**
 * POST /ai/weekly-summary — generate a 2-sentence training summary from the
 * weekly metrics in the request body (uses the most recent 4 weeks).
 */
async function weeklySummary(req, res, next) {
  try {
    const weeks = Array.isArray(req.body?.weeks) ? req.body.weeks : null;
    if (!weeks || weeks.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Provide a non-empty "weeks" array of metrics.',
      });
    }

    const summary = await ai.generateWeeklySummary(weeks.slice(-4));
    res.json({ success: true, data: { summary }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { weeklySummary };
