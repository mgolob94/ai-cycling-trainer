const metrics = require('../services/metrics');

/**
 * GET /metrics/weekly — recompute weekly training-load metrics from the user's
 * ride history, persist them, and return the most recent 12 weeks.
 */
async function weekly(req, res, next) {
  try {
    const weeks = await metrics.calculateAndStore(req.user.id);
    res.json({ success: true, data: weeks.slice(-12), error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { weekly };
